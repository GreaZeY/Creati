package main

import (
	"context"
	"database/sql"
	"os"
	"os/signal"
	"syscall"

	"creati.in/creati/backend/internal/app"
	"creati.in/creati/backend/internal/logger"
	"creati.in/creati/backend/internal/services"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	_ = godotenv.Load()

	dbURL := os.Getenv("DATABASE_URL")
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		logger.Get("worker").Fatal(err)
	}
	defer db.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		cancel()
	}()

	// 1. Initialize Redis/Queue
	queueService, err := services.NewQueueService()
	if err != nil {
		logger.Get("worker").Fatal(err)
	}

	// 2. Initialize Throttler
	throttleService := services.NewThrottleService(queueService.Client)
	whatsappService := services.NewWhatsAppService()

	if err := app.RunWorker(ctx, db, throttleService, whatsappService); err != nil {
		logger.Get("worker").Fatal(err)
	}
}
