package commands

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/fatih/color"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
	"github.com/spf13/cobra"
)

var queueCmd = &cobra.Command{
	Use:   "queue",
	Short: "Manage background job queues (Redis)",
}

var queueInfoCmd = &cobra.Command{
	Use:   "info",
	Short: "Show items in the upload_queue",
	Run:   runQueueInfo,
}

var queueClearCmd = &cobra.Command{
	Use:   "clear",
	Short: "Flush the upload_queue",
	Run:   runQueueClear,
}

var queueUpCmd = &cobra.Command{
	Use:   "up",
	Short: "Start Redis queue service (Docker)",
	RunE: func(cmd *cobra.Command, args []string) error {
		return StartServices()
	},
}

var queueDownCmd = &cobra.Command{
	Use:   "down",
	Short: "Stop Redis queue service (Docker)",
	RunE: func(cmd *cobra.Command, args []string) error {
		// StopServices brings down the whole stack which includes redis
		return StopServices()
	},
}

func init() {
	queueCmd.AddCommand(queueInfoCmd)
	queueCmd.AddCommand(queueClearCmd)
	queueCmd.AddCommand(queueUpCmd)
	queueCmd.AddCommand(queueDownCmd)
	rootCmd.AddCommand(queueCmd)
}

func getRedisClient() (*redis.Client, string) {
	_ = godotenv.Load(filepath.Join(GetConfig().BackendPath, ".env"))
	redisURL := os.Getenv("REDIS_QUEUE_URL")
	if redisURL == "" {
		redisURL = "localhost:6380"
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		opt = &redis.Options{Addr: redisURL}
	}

	return redis.NewClient(opt), redisURL
}

func runQueueInfo(cmd *cobra.Command, args []string) {
	client, url := getRedisClient()
	ctx := context.Background()

	queues := []string{
		"ingestion_queue",
		"orchestration_queue",
		"upload_queue",
		"post_process_queue",
		"notification_queue",
		"upload_dlq",
		"notify_dlq",
	}

	fmt.Printf("🔗 Redis connected (Queue): %s\n", url)
	fmt.Println("📊 Queue Status:")

	for _, q := range queues {
		length, err := client.LLen(ctx, q).Result()
		if err != nil {
			fmt.Printf("  ❌ %-20s: Connection error\n", q)
			continue
		}

		output := fmt.Sprintf("  🔹 %-20s: %d items", q, length)
		if length > 0 {
			color.Cyan(output)
		} else {
			fmt.Println(output)
		}
	}
}

func runQueueClear(cmd *cobra.Command, args []string) {
	client, url := getRedisClient()
	ctx := context.Background()

	queues := []string{
		"ingestion_queue",
		"orchestration_queue",
		"upload_queue",
		"post_process_queue",
		"notification_queue",
		"upload_dlq",
		"notify_dlq",
	}

	fmt.Printf("🔗 Redis connected (Queue): %s\n", url)

	for _, q := range queues {
		err := client.Del(ctx, q).Err()
		if err != nil {
			fmt.Printf("  ❌ Failed to clear %s\n", q)
		} else {
			fmt.Printf("  ✅ %s cleared\n", q)
		}
	}
	color.Green("\n✨ All queues successfully cleared\n")
}
