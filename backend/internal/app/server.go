package app

import (
	"context"
	"database/sql"
	"time"

	"creati.in/creati/backend/internal/api"
	"creati.in/creati/backend/internal/features"
	"creati.in/creati/backend/internal/logger"
	"creati.in/creati/backend/internal/middleware"
	"creati.in/creati/backend/internal/services"
	"creati.in/creati/backend/internal/workers"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	fiberlog "github.com/gofiber/fiber/v2/middleware/logger"
)

func RunServer(ctx context.Context, db *sql.DB) error {
	// Initialize services
	storageService, err := services.NewStorageService()
	if err != nil {
		logger.Get("server").WithError(err).Warn("Storage service failed to initialize")
	}

	queueService, err := services.NewQueueService()
	if err != nil {
		logger.Get("server").WithError(err).Warn("Queue service failed to initialize")
	}

	// Create Fiber app
	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
	})

	// Middleware
	app.Use(fiberlog.New())
	app.Use(cors.New())

	// Initialize handlers
	authHandler := api.NewAuthHandler(db)
	platformHandler := api.NewPlatformHandler(db)
	uploadHandler := api.NewUploadHandler(storageService, queueService, db)
	videosHandler := api.NewVideosHandler(db)
	analyticsHandler := api.NewAnalyticsHandler(db)
	automationService := services.NewAutomationService(db, queueService)
	automationHandler := api.NewAutomationHandler(db, automationService)
	paymentHandler := api.NewPaymentHandler(db)
	webhookHandler := api.NewWebhookHandler(db)

	// Events
	eventProcessor := workers.NewEventProcessor(db, 30*time.Second, 50)
	go eventProcessor.Start(ctx)

	// Routes
	apiRoutes := app.Group("/api")
	apiRoutes.Post("/auth/register", authHandler.Register)
	apiRoutes.Post("/auth/login", authHandler.Login)
	apiRoutes.Post("/auth/logout", authHandler.Logout)
	apiRoutes.Post("/platforms/:platform/callback", platformHandler.HandleCallback)

	webhooks := app.Group("/webhooks")
	webhooks.Get("/youtube", webhookHandler.YouTubeWebhookVerification)
	webhooks.Post("/youtube", webhookHandler.YouTubeWebhookNotification)
	webhooks.Post("/razorpay", paymentHandler.HandleWebhook)

	protected := apiRoutes.Use(middleware.AuthMiddleware)
	protected.Get("/auth/me", authHandler.CheckAuth)
	protected.Post("/upload/init", uploadHandler.InitUpload)
	protected.Post("/upload/confirm", uploadHandler.ConfirmUpload)
	protected.Get("/platforms/count", platformHandler.GetPlatformCounts)
	protected.Get("/platforms", platformHandler.ListPlatforms)
	protected.Get("/platforms/:platform/connect", platformHandler.InitiateConnection)
	protected.Put("/platforms/:platform/disconnect", platformHandler.DeactivatePlatform)
	protected.Delete("/platforms/:platform", platformHandler.RemovePlatform)
	protected.Get("/platforms/:platform/videos", platformHandler.GetRecentVideos)
	protected.Get("/videos", videosHandler.ListVideos)
	protected.Get("/videos/:id/status", videosHandler.GetVideoStatus)
	protected.Get("/videos/:id/analytics", videosHandler.GetVideoAnalytics)
	protected.Get("/analytics/overview", analyticsHandler.GetOverview)
	protected.Get("/events", webhookHandler.ListEvents)
	protected.Get("/events/:id", webhookHandler.GetEvent)
	protected.Post("/events/:id/replay", webhookHandler.ReplayEvent)

	automationGroup := protected.Group("/automation", middleware.RequireFeature(db, features.CanUseMagicSync))
	automationGroup.Get("", automationHandler.ListRules)
	automationGroup.Post("", automationHandler.CreateRule)
	automationGroup.Post("/blast", automationHandler.HandleBlast)
	automationGroup.Get("/rules/:id/summary", automationHandler.GetRuleJobSummary)
	automationGroup.Put("/:id", automationHandler.ToggleRule)
	automationGroup.Delete("/:id", automationHandler.DeleteRule)

	protected.Post("/payments/create-subscription", paymentHandler.CreateSubscription)
	protected.Post("/payments/verify-subscription", paymentHandler.VerifySubscription)
	protected.Put("/payments/subscription", paymentHandler.UpdateSubscription)
	protected.Delete("/payments/subscription", paymentHandler.CancelSubscription)
	protected.Get("/payments/subscription", paymentHandler.GetSubscription)

	// Graceful shutdown
	go func() {
		<-ctx.Done()
		app.Shutdown()
	}()

	port := "8080"
	return app.Listen(":" + port)
}
