package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"creati.in/creati/backend/internal/services"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
)

func main() {
	_ = godotenv.Load()
	dbURL := os.Getenv("DATABASE_URL")
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "localhost:6379"
	}
	opt, _ := redis.ParseURL(redisURL)
	if opt == nil {
		opt = &redis.Options{Addr: redisURL}
	}
	redisClient := redis.NewClient(opt)
	ctx := context.Background()

	// 1. Find jobs stuck in 'processing'
	rows, err := db.Query("SELECT id, rule_id, target_account_id, source_platform_id FROM automation_jobs WHERE status = 'processing'")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	for rows.Next() {
		var jobID, ruleID, accountID int
		var sourceVideoID string
		if err := rows.Scan(&jobID, &ruleID, &accountID, &sourceVideoID); err != nil {
			log.Fatal(err)
		}

		// 2. Fetch platform for account
		var platform string
		db.QueryRow("SELECT platform FROM platform_accounts WHERE id = $1", accountID).Scan(&platform)

		fmt.Printf("Resetting job %d (%s)...\n", jobID, sourceVideoID)

		// 3. Reset status in DB
		db.Exec("UPDATE automation_jobs SET status = 'pending', updated_at = NOW() WHERE id = $1", jobID)

		// 4. Re-enqueue in Redis
		job := services.UploadJob{
			AutomationJobID: jobID,
			SourceVideoID:   sourceVideoID,
			AccountID:       accountID,
			Platform:        platform,
		}
		data, _ := json.Marshal(job)
		redisClient.LPush(ctx, "upload_queue", data)
		fmt.Printf("Enqueued job %d for platform %s\n", jobID, platform)
	}
	fmt.Println("Reset complete.")
}
