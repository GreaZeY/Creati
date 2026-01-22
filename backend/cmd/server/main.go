package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	"example.com/creati/backend/internal/api"
	"example.com/creati/backend/internal/middleware"
	"example.com/creati/backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️  No .env file found, using system environment")
	}

	// Connect to database
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("❌ DATABASE_URL not set. Run setup.ps1 or set environment variables.")
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal("❌ Failed to connect to database:", err)
	}
	defer db.Close()

	// Test database connection
	if err := db.Ping(); err != nil {
		log.Println("❌ Database ping failed:", err)
		log.Println("💡 Make sure PostgreSQL is running and DATABASE_URL is correct")
		log.Println("   Run: psql -U postgres -d creati -f internal/db/migrations/001_init.sql")
		os.Exit(1)
	}
	log.Println("✓ Database connected")

	// Create Fiber app
	app := fiber.New(fiber.Config{
		ErrorHandler: customErrorHandler,
	})

	// Middleware
	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${status} - ${method} ${path}\n",
	}))

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:5173"
	}

	app.Use(cors.New(cors.Config{
		AllowOrigins:     frontendURL,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, X-CSRF-Token",
		AllowMethods:     "GET, POST, PUT, DELETE, OPTIONS",
		AllowCredentials: true,
	}))

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":   "ok",
			"database": "connected",
		})
	})

	// Pre-flight check
	fmt.Println("\n📋 Pre-flight Checks:")

	storageService, err := services.NewStorageService()
	if err != nil {
		fmt.Printf("  ❌ S3 Storage: Failed (%v)\n", err)
	} else {
		fmt.Println("  ✅ S3 Storage: Initialized")
	}

	queueService, err := services.NewQueueService()
	if err != nil {
		fmt.Printf("  ❌ Redis Queue: Failed (%v)\n", err)
	} else {
		fmt.Println("  ✅ Redis Queue: Initialized")
	}

	if os.Getenv("YOUTUBE_CLIENT_ID") == "" {
		fmt.Println("  ⚠️  YouTube API: Credentials missing")
	} else {
		fmt.Println("  ✅ YouTube API: Credentials found")
	}

	// Initialize handlers
	authHandler := api.NewAuthHandler(db)
	platformHandler := api.NewPlatformHandler(db)
	uploadHandler := api.NewUploadHandler(storageService, queueService, db)
	videosHandler := api.NewVideosHandler(db)
	analyticsHandler := api.NewAnalyticsHandler(db)
	automationService := services.NewAutomationService(db, queueService)
	automationHandler := api.NewAutomationHandler(db, automationService)
	paymentHandler := api.NewPaymentHandler(db)

	// API routes
	apiRoutes := app.Group("/api")

	// Public routes
	apiRoutes.Post("/auth/register", authHandler.Register)
	apiRoutes.Post("/auth/login", authHandler.Login)
	apiRoutes.Post("/auth/logout", authHandler.Logout) // Logout can be public or protected, technically public to clear cookie is fine

	// OAuth callback (public)
	apiRoutes.Get("/platforms/:platform/callback", platformHandler.HandleCallback)

	// Webhooks (public)
	apiRoutes.Get("/webhooks/youtube", automationHandler.HandleYouTubeWebhook)
	apiRoutes.Post("/webhooks/youtube", automationHandler.HandleYouTubeWebhook)

	// Protected routes (require authentication)
	protected := apiRoutes.Use(middleware.AuthMiddleware)

	// Auth Check
	protected.Get("/auth/me", authHandler.CheckAuth)

	// Uploads
	protected.Post("/upload/init", uploadHandler.InitUpload)
	protected.Post("/upload/confirm", uploadHandler.ConfirmUpload)

	// Platforms
	protected.Get("/platforms", platformHandler.ListPlatforms)
	protected.Get("/platforms/:platform/connect", platformHandler.InitiateConnection)
	protected.Put("/platforms/:platform/disconnect", platformHandler.DeactivatePlatform)
	protected.Delete("/platforms/:platform", platformHandler.RemovePlatform)

	// Videos & Dashboard
	protected.Get("/videos", videosHandler.ListVideos)
	protected.Get("/videos/:id/status", videosHandler.GetVideoStatus)
	protected.Get("/videos/:id/analytics", videosHandler.GetVideoAnalytics)

	// Analytics
	protected.Get("/analytics/overview", analyticsHandler.GetOverview)

	// Automation
	protected.Get("/automation", automationHandler.ListRules)
	protected.Post("/automation", automationHandler.CreateRule)
	protected.Put("/automation/:id", automationHandler.ToggleRule)
	protected.Delete("/automation/:id", automationHandler.DeleteRule)

	// Payments
	protected.Post("/payments/create-order", paymentHandler.CreateOrder)
	protected.Post("/payments/verify", paymentHandler.VerifyPayment)
	protected.Get("/payments/subscription", paymentHandler.GetSubscription)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Println("\n========================================")
	fmt.Println("🚀 Server starting on port", port)
	fmt.Println("========================================")
	fmt.Println("Frontend: " + frontendURL)
	fmt.Println("API: http://localhost:" + port)
	fmt.Println("Health: http://localhost:" + port + "/health")
	fmt.Println("========================================")
	log.Fatal(app.Listen(":" + port))
}

// Custom error handler for better error responses
func customErrorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	message := "Internal Server Error"

	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
		message = e.Message
	}

	return c.Status(code).JSON(fiber.Map{
		"success": false,
		"error":   message,
	})
}
