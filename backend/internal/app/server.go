package app

import (
	"context"
	"database/sql"
	"os"
	"time"

	"creati.in/creati/backend/internal/api"
	"creati.in/creati/backend/internal/features"
	"creati.in/creati/backend/internal/logger"
	"creati.in/creati/backend/internal/middleware"
	"creati.in/creati/backend/internal/services"
	"creati.in/creati/backend/internal/workers"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/redis/go-redis/v9"
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
		// Custom ErrorHandler to capture and log every error systemically
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			// Status code defaults to 500
			code := fiber.StatusInternalServerError

			// Retrieve custom status code if it's a *fiber.Error
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}

			// Store the actual error in Locals so the Logger middleware can see it
			c.Locals("internal_error", err)

			// Return standardized JSON error response
			return c.Status(code).JSON(fiber.Map{
				"success": false,
				"error":   err.Error(),
			})
		},
	})

	// Middleware
	app.Use(requestid.New())          // Generate X-Request-ID
	app.Use(middleware.RequestLogger) // Log requests with Trace ID

	// CORS - Allow credentials (required for SSE with auth)
	app.Use(cors.New(cors.Config{
		AllowOrigins:     os.Getenv("FRONTEND_URL"),
		AllowCredentials: true,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, X-CSRF-Token",
		AllowMethods:     "GET, POST, PUT, DELETE, OPTIONS",
	}))

	// Static storage (for local driver)
	app.Static("/storage", "./storage")

	// Initialize Cache Client independently
	cacheRedisURL := os.Getenv("REDIS_CACHE_URL")
	if cacheRedisURL == "" {
		cacheRedisURL = "localhost:6379"
	}
	cacheOpt, _ := redis.ParseURL(cacheRedisURL)
	if cacheOpt == nil {
		cacheOpt = &redis.Options{Addr: cacheRedisURL}
	}
	cacheClient := redis.NewClient(cacheOpt)
	cacheService := services.NewCacheService(cacheClient)

	// Initialize RealtimeService (SSE)
	realtimeService := services.NewRealtimeService()

	// Initialize Services
	mediaService := services.NewMediaService(db, storageService)

	// Initialize handlers
	authHandler := api.NewAuthHandler(db)
	platformHandler := api.NewPlatformHandler(db, cacheService, storageService)
	uploadHandler := api.NewUploadHandler(storageService, queueService, db)
	videosHandler := api.NewVideosHandler(db, cacheService)
	analyticsHandler := api.NewAnalyticsHandler(db, queueService, cacheService)
	automationService := services.NewAutomationService(db, queueService)
	automationHandler := api.NewAutomationHandler(db, automationService)
	paymentHandler := api.NewPaymentHandler(db)
	webhookHandler := api.NewWebhookHandler(db)
	agencyHandler := api.NewAgencyHandler(db)
	aiHandler := api.NewAiHandler(db)
	postsHandler := api.NewPostsHandler(db, storageService, queueService)
	proxyHandler := api.NewProxyHandler(db, mediaService)
	// audienceHandler := api.NewAudienceHandler(db)

	// Events
	dbURL := os.Getenv("DATABASE_URL")
	eventProcessor := workers.NewEventProcessor(db, dbURL, realtimeService, 30*time.Second, 50)
	go eventProcessor.Start(ctx)

	// Scheduler Worker
	scheduler := workers.NewScheduler(db, queueService, 30*time.Second)
	go scheduler.Start(ctx)

	// Routes
	apiRoutes := app.Group("/api")
	apiRoutes.Post("/auth/register", authHandler.Register)
	apiRoutes.Post("/auth/login", authHandler.Login)
	apiRoutes.Post("/auth/logout", authHandler.Logout)
	apiRoutes.Post("/auth/google", authHandler.GoogleLogin)
	apiRoutes.Post("/platforms/:platform/callback", platformHandler.HandleCallback)
	apiRoutes.Get("/proxy/video", proxyHandler.HandleProxyVideo)

	webhooks := app.Group("/webhooks")
	webhooks.Get("/youtube", webhookHandler.YouTubeWebhookVerification)
	webhooks.Post("/youtube", webhookHandler.YouTubeWebhookNotification)
	webhooks.Post("/razorpay", paymentHandler.HandleWebhook)

	protected := apiRoutes.Use(middleware.AuthMiddleware)
	protected.Get("/auth/me", authHandler.CheckAuth)
	protected.Put("/auth/profile", authHandler.UpdateProfile)

	// Agency Routes
	agencyRoutes := protected.Group("/agency")
	agencyRoutes.Get("/clients", agencyHandler.ListClients)
	agencyRoutes.Post("/clients", agencyHandler.CreateClient)
	agencyRoutes.Put("/clients/reorder", agencyHandler.ReorderClients)
	agencyRoutes.Put("/clients/commit", agencyHandler.BatchUpdateClients)
	agencyRoutes.Put("/clients/:id", agencyHandler.UpdateClient)
	agencyRoutes.Delete("/clients/:id", agencyHandler.DeleteClient)

	protected.Get("/realtime/blasts", func(c *fiber.Ctx) error {
		userID := middleware.GetUserID(c)
		return realtimeService.HandleConnection(c, userID)
	})
	protected.Post("/upload/init", uploadHandler.InitUpload)
	protected.Post("/upload/confirm", uploadHandler.ConfirmUpload)
	protected.Get("/platforms/counts", platformHandler.GetPlatformCounts)
	protected.Get("/platforms", platformHandler.ListPlatforms)
	protected.Get("/platforms/:platform/connect", platformHandler.InitiateConnection)
	protected.Put("/platforms/:platform/disconnect", platformHandler.DeactivatePlatform)
	protected.Delete("/platforms/:platform", platformHandler.RemovePlatform)
	protected.Get("/platforms/:platform/videos", platformHandler.GetRecentVideos)
	// protected.Get("/proxy/video", proxyHandler.HandleProxyVideo) // Moved to public to support <video> tag
	protected.Get("/videos", videosHandler.ListVideos)
	protected.Get("/videos/:id/status", videosHandler.GetVideoStatus)
	protected.Get("/videos/:id/analytics", videosHandler.GetVideoAnalytics)
	protected.Get("/analytics/overview", analyticsHandler.GetOverview)
	protected.Get("/events", webhookHandler.ListEvents)
	protected.Get("/events/:id", webhookHandler.GetEvent)
	protected.Post("/events/:id/replay", webhookHandler.ReplayEvent)

	automationGroup := protected.Group("/automation", middleware.RequireFeature(db, cacheService, features.CanUseMagicSync))
	automationGroup.Get("", automationHandler.ListRules)
	automationGroup.Get("/jobs", automationHandler.ListJobs)
	automationGroup.Get("/jobs/:id/details", automationHandler.GetJobDetails)
	automationGroup.Post("", automationHandler.CreateRule)
	automationGroup.Post("/blast", automationHandler.HandleBlast)
	automationGroup.Post("/executions/:id/retry", automationHandler.RetryExecution)
	automationGroup.Post("/executions/:id/cancel", automationHandler.CancelExecution)
	automationGroup.Post("/executions/:id/pause", automationHandler.PauseExecution)
	automationGroup.Post("/rules/:id/retry", automationHandler.RetryRule)
	automationGroup.Put("/:id", automationHandler.ToggleRule)
	automationGroup.Put("/:id/full", automationHandler.UpdateRule)
	automationGroup.Delete("/:id", automationHandler.DeleteRule)

	// audienceGroup := protected.Group("/audience", middleware.RequireFeature(db, cacheService, features.CanUseAudienceNotifications))
	// audienceGroup.Get("/rules", audienceHandler.ListRules)
	// audienceGroup.Post("/rules", audienceHandler.CreateRule)
	// audienceGroup.Put("/rules/:id/toggle", audienceHandler.ToggleRule)
	// audienceGroup.Delete("/rules/:id", audienceHandler.DeleteRule)
	// audienceGroup.Get("/templates", audienceHandler.GetTemplate)
	// audienceGroup.Post("/templates", audienceHandler.SaveTemplate)

	protected.Post("/payments/create-subscription", paymentHandler.CreateSubscription)
	protected.Post("/payments/verify-subscription", paymentHandler.VerifySubscription)
	protected.Put("/payments/subscription", paymentHandler.UpdateSubscription)
	protected.Delete("/payments/subscription", paymentHandler.CancelSubscription)
	protected.Get("/payments/subscription", paymentHandler.GetSubscription)

	// AI & Credits
	aiRoutes := protected.Group("/ai")
	aiRoutes.Get("/credits", aiHandler.GetCredits)
	aiRoutes.Post("/generate", aiHandler.GeneratePost)
	aiRoutes.Post("/rewrite", aiHandler.RewritePost)

	// Posts & Media
	protected.Post("/media/upload", postsHandler.UploadMedia)
	protected.Post("/posts", postsHandler.CreatePost)

	// Graceful shutdown
	go func() {
		<-ctx.Done()
		app.Shutdown()
	}()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	return app.Listen(":" + port)
}
