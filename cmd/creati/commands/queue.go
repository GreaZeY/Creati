package commands

import (
	"context"
	"fmt"
	"os"

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
	Run: func(cmd *cobra.Command, args []string) {
		// We could start just redis, but StartServices(true) is safer to ensure stack health
		StartServices(true)
	},
}

var queueDownCmd = &cobra.Command{
	Use:   "down",
	Short: "Stop Redis queue service (Docker)",
	Run: func(cmd *cobra.Command, args []string) {
		// StopServices brings down the whole stack which includes redis
		StopServices()
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
	_ = godotenv.Load("backend/.env")
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "localhost:6379"
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

	length, err := client.LLen(ctx, "upload_queue").Result()
	if err != nil {
		fmt.Printf("❌ Failed to connect to Redis at %s: %v\n", url, err)
		return
	}

	fmt.Printf("🔗 Redis connected: %s\n", url)
	color.Cyan("📊 Items in upload_queue: %d\n", length)
}

func runQueueClear(cmd *cobra.Command, args []string) {
	client, url := getRedisClient()
	ctx := context.Background()

	err := client.Del(ctx, "upload_queue").Err()
	if err != nil {
		fmt.Printf("❌ Failed to clear queue at %s: %v\n", url, err)
		return
	}

	fmt.Printf("🔗 Redis connected: %s\n", url)
	color.Green("✅ upload_queue successfully cleared\n")
}
