package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

func main() {
	_ = godotenv.Load()
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "localhost:6379"
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		opt = &redis.Options{Addr: redisURL}
	}

	client := redis.NewClient(opt)
	ctx := context.Background()

	len, err := client.LLen(ctx, "upload_queue").Result()
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Redis connected: %s\n", redisURL)
	fmt.Printf("Items in upload_queue: %d\n", len)
}
