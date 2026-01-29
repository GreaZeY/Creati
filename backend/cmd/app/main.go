package main

import (
	"log"
	"os"

	"example.com/creati/backend/internal/app"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	_ = godotenv.Load()

	cfg := app.Config{
		RunMode: os.Getenv("RUN_MODE"),
		DBURL:   os.Getenv("DATABASE_URL"),
	}

	if cfg.RunMode == "" {
		cfg.RunMode = "all"
	}

	if err := app.Run(cfg); err != nil {
		log.Fatalf("Fatal error: %v", err)
	}
}
