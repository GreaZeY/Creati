package services

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type ThrottleService struct {
	client *redis.Client
}

func NewThrottleService(client *redis.Client) *ThrottleService {
	return &ThrottleService{client: client}
}

// Allow checks if a request is allowed under a specific limit
// key: unique identifier for the throttler (e.g., "youtube:global" or "user:123:blast")
// limit: max requests in the window
// window: duration of the window
func (s *ThrottleService) Allow(ctx context.Context, key string, limit int, window time.Duration) (bool, error) {
	fullKey := fmt.Sprintf("throttle:%s", key)
	
	// Implementation using Redis INCR + EXPIRE (Fixed Window)
	// For high precision, we could use a Lua script for Token Bucket,
	// but Fixed Window is sufficient for platform API protection.
	count, err := s.client.Incr(ctx, fullKey).Result()
	if err != nil {
		return false, err
	}

	if count == 1 {
		// New window, set expiration
		s.client.Expire(ctx, fullKey, window)
	}

	if count > int64(limit) {
		return false, nil
	}

	return true, nil
}

// Wait blocks until a request is allowed (simple retry logic)
func (s *ThrottleService) Wait(ctx context.Context, key string, limit int, window time.Duration) error {
	for {
		allowed, err := s.Allow(ctx, key, limit, window)
		if err != nil {
			return err
		}
		if allowed {
			return nil
		}

		// Wait 1 second before retrying
		ticker := time.NewTicker(time.Second)
		select {
		case <-ctx.Done():
			ticker.Stop()
			return ctx.Err()
		case <-ticker.C:
			ticker.Stop()
			continue
		}
	}
}
