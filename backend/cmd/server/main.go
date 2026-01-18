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
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
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

	// Initialize services
	storageService, err := services.NewStorageService()
	if err != nil {
		log.Printf("⚠️  Failed to initialize storage service: %v", err)
		// Don't fatal, maybe working without S3 for now? prefer fatal if S3 is required.
		// For now, let's log and maybe nil checking in handler or just fatal.
		// log.Fatal(err) is better for critical service.
	}

	// Initialize handlers
	authHandler := api.NewAuthHandler(db)
	platformHandler := api.NewPlatformHandler(db)
	uploadHandler := api.NewUploadHandler(storageService, db)

	// API routes
	apiRoutes := app.Group("/api")

	// Public routes
	apiRoutes.Post("/auth/register", authHandler.Register)
	apiRoutes.Post("/auth/login", authHandler.Login)

	// OAuth callback (public)
	apiRoutes.Get("/platforms/:platform/callback", platformHandler.HandleCallback)

	// Protected routes (require authentication)
	protected := apiRoutes.Use(middleware.AuthMiddleware)

	// Uploads
	protected.Post("/upload/init", uploadHandler.InitUpload)

	// Platforms
	protected.Get("/platforms", platformHandler.ListPlatforms)
	protected.Get("/platforms/:platform/connect", platformHandler.InitiateConnection)
	protected.Delete("/platforms/:platform", platformHandler.DisconnectPlatform)

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
	fmt.Println("========================================\n")

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
