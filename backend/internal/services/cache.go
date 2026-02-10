package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"creati.in/creati/backend/internal/types"
	"github.com/redis/go-redis/v9"
)

type CacheService struct {
	client *redis.Client
}

func NewCacheService(client *redis.Client) *CacheService {
	return &CacheService{client: client}
}

// Set stores a value in the cache with a TTL
func (s *CacheService) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return s.client.Set(ctx, key, data, ttl).Err()
}

// Get retrieves a value from the cache
func (s *CacheService) Get(ctx context.Context, key string, target interface{}) error {
	data, err := s.client.Get(ctx, key).Bytes()
	if err != nil {
		if err == redis.Nil {
			return fmt.Errorf("cache miss")
		}
		return err
	}
	return json.Unmarshal(data, target)
}

// Delete removes a key from the cache
func (s *CacheService) Delete(ctx context.Context, key string) error {
	return s.client.Del(ctx, key).Err()
}

// GetAccountsKey builds a cache key for account-related lists based on user context
func (s *CacheService) GetAccountsKey(ctx types.UserContext, suffix string) string {
	key := fmt.Sprintf("user:%d:accounts:%s", ctx.UserID, suffix)
	if ctx.ClientID != nil {
		return fmt.Sprintf("%s:%d", key, *ctx.ClientID)
	}
	return key + ":personal"
}

// Keys for common cached items
func UserFeatureKey(userID int, feature string) string {
	return fmt.Sprintf("user:%d:feature:%s", userID, feature)
}

func UserAccountsKey(userID int) string {
	return fmt.Sprintf("user:%d:accounts", userID)
}

func AccountKey(accountID int) string {
	return fmt.Sprintf("account:%d", accountID)
}
