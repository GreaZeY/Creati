package app

import (
	"context"
	"database/sql"
	"os"
	"os/signal"
	"syscall"

	"creati.in/creati/backend/internal/logger"
	"creati.in/creati/backend/internal/services"
	"golang.org/x/sync/errgroup"
)

type Config struct {
	RunMode string // "all", "server", "worker"
	DBURL   string
}

func Run(cfg Config) error {
	// 1. Setup Database
	db, err := sql.Open("postgres", cfg.DBURL)
	if err != nil {
		return err
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		return err
	}

	// 2. Setup Context & Signal Handling
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	g, ctx := errgroup.WithContext(ctx)

	// 3. Start Services
	if cfg.RunMode == "all" || cfg.RunMode == "server" {
		g.Go(func() error {
			return RunServer(ctx, db)
		})
	}

	if cfg.RunMode == "all" || cfg.RunMode == "worker" {
		logger.Get("app").Info("Initializing Worker...")
		g.Go(func() error {
			// Initialize Queue & Throttle for Worker
			logger.Get("app").Info("Starting Worker Service...")

			queueService, err := services.NewQueueService()
			if err != nil {
				logger.Get("app").WithError(err).Error("Failed to initialize QueueService for worker")
				return err
			}
			// Throttle service primarily uses the queue client for global rate limiting
			throttle := services.NewThrottleService(queueService.Client)

			return RunWorker(ctx, db, throttle)
		})
	}

	// 4. Wait for shutdown signal or error
	go func() {
		select {
		case <-sigChan:
			logger.Get("app").Info("Shutdown signal received")
		case <-ctx.Done():
		}
		cancel()
	}()

	return g.Wait()
}
