package services

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"
)

// AnalyticsService handles efficient stats gathering and caching
type AnalyticsService struct {
	db    *sql.DB
	cache *CacheService
}

func NewAnalyticsService(db *sql.DB, cache *CacheService) *AnalyticsService {
	return &AnalyticsService{db: db, cache: cache}
}

// PlatformStat represents metrics per platform
type PlatformStat struct {
	Platform string  `json:"platform"`
	Views    int64   `json:"views"`
	Revenue  float64 `json:"revenue"`
}

// UserStats represents aggregated user metrics
type UserStats struct {
	TotalVideos      int            `json:"totalVideos"`
	TotalViews       int64          `json:"totalViews"`
	TotalLikes       int64          `json:"totalLikes"`
	TotalComments    int64          `json:"totalComments"`
	TotalShares      int64          `json:"totalShares"`
	PlatformBreakdown []PlatformStat `json:"platformBreakdown"`
	ProjectedRevenue  float64        `json:"projectedRevenue"`
}

// VideoStats represents aggregated video metrics
type VideoStats struct {
	VideoID       int       `json:"videoId"`
	Title         string    `json:"title"`
	CreatedAt     time.Time `json:"createdAt"`
	TotalViews    int64     `json:"totalViews"`
	TotalLikes    int64     `json:"totalLikes"`
	TotalComments int64     `json:"totalComments"`
	LastUpdated   time.Time `json:"lastUpdated"`
}

// GetUserStats fetches aggregated stats from view (Fast)
func (s *AnalyticsService) GetUserStats(userID int) (*UserStats, error) {
	stats := &UserStats{
		PlatformBreakdown: []PlatformStat{},
	}

	// 1. Core aggregates
	err := s.db.QueryRow(`
		SELECT total_videos, total_views, total_likes, total_comments, total_shares
		FROM vw_user_stats WHERE user_id = $1
	`, userID).Scan(
		&stats.TotalVideos, &stats.TotalViews, &stats.TotalLikes, &stats.TotalComments, &stats.TotalShares,
	)

	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	// 2. Fetch platform breakdown
	rows, err := s.db.Query(`
		SELECT platform, COALESCE(SUM(views), 0)
		FROM (
			SELECT DISTINCT ON (video_id, account_id) platform, views
			FROM video_analytics
			WHERE video_id IN (SELECT id FROM videos WHERE user_id = $1)
			ORDER BY video_id, account_id, fetched_at DESC
		) latest_per_account
		GROUP BY platform
	`, userID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var p PlatformStat
			if err := rows.Scan(&p.Platform, &p.Views); err == nil {
				// Mock revenue calculation: $2.00 per 1k views (generic RPM)
				p.Revenue = float64(p.Views) * 0.002
				stats.PlatformBreakdown = append(stats.PlatformBreakdown, p)
				stats.ProjectedRevenue += p.Revenue
			}
		}
	}

	return stats, nil
}

// GetVideoStats fetches specific video stats from view (Fast)
func (s *AnalyticsService) GetVideoStats(videoID int) (*VideoStats, error) {
	stats := &VideoStats{}

	err := s.db.QueryRow(`
		SELECT video_id, title, created_at, total_views, total_likes, total_comments, last_updated
		FROM vw_video_stats WHERE video_id = $1
	`, videoID).Scan(
		&stats.VideoID, &stats.Title, &stats.CreatedAt,
		&stats.TotalViews, &stats.TotalLikes, &stats.TotalComments, &stats.LastUpdated,
	)

	if err != nil {
		return nil, err
	}
	return stats, nil
}

// SyncUserAnalytics triggers synchronization for all user's videos (Async friendly)
func (s *AnalyticsService) SyncUserAnalytics(userID int) {
	// 1. Discover external videos first (ingest pre-existing platform content)
	s.DiscoverVideos(userID)

	// 2. Find all videos for user (now including newly discovered ones)
	rows, err := s.db.Query("SELECT id FROM videos WHERE user_id = $1", userID)
	if err != nil {
		log.Printf("Failed to list videos for sync: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var videoID int
		if err := rows.Scan(&videoID); err == nil {
			s.SyncVideoAnalytics(videoID)
		}
	}
}

// SyncVideoAnalytics fetches fresh data from platforms and updates cache
func (s *AnalyticsService) SyncVideoAnalytics(videoID int) {
	// 1. Find connected platforms and accounts for this video
	rows, err := s.db.Query(`
		SELECT platform, platform_id, account_id
		FROM video_platform_jobs 
		WHERE video_id = $1 AND status = 'completed' AND platform_id IS NOT NULL
	`, videoID)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var platform, platformID string
		var accountID int
		if err := rows.Scan(&platform, &platformID, &accountID); err != nil {
			continue
		}

		// 2. Check if we need to update this specific (video, account) pair
		var lastFetched time.Time
		err := s.db.QueryRow(`
			SELECT fetched_at FROM video_analytics 
			WHERE video_id = $1 AND account_id = $2 
			ORDER BY fetched_at DESC LIMIT 1
		`, videoID, accountID).Scan(&lastFetched)

		// If data is fresh (< 1 hour), skip update for this account
		if err == nil && time.Since(lastFetched) < 1*time.Hour {
			continue
		}

		// 3. Use factory to get service
		svc, err := GetPlatformService(platform, s.db)
		if err != nil {
			continue
		}

		// 4. Fetch from external API
		stats, err := svc.FetchAnalytics(platformID, accountID)
		if err != nil {
			log.Printf("Failed to fetch analytics for %s video %s (account %d): %v", platform, platformID, accountID, err)
			continue
		}

		// 5. Insert snapshot
		_, err = s.db.Exec(`
			INSERT INTO video_analytics (video_id, account_id, platform, views, likes, comments, shares)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, videoID, accountID, platform, stats.Views, stats.Likes, stats.Comments, stats.Shares)

		if err != nil {
			log.Printf("Failed to save analytics snapshot: %v", err)
		}
	}
}
// DiscoverVideos pulls existing videos from connected platforms and registers them in Creati
func (s *AnalyticsService) DiscoverVideos(userID int) {
	// Throttle discovery to once every 6 hours per user
	discoveryKey := fmt.Sprintf("discovery:user:%d", userID)
	if s.cache != nil {
		var last string
		if err := s.cache.Get(context.Background(), discoveryKey, &last); err == nil {
			log.Printf("Discovery throttle: Skipping for user %d (already ran recently)", userID)
			return
		}
	}

	// Find all connected accounts for user
	rows, err := s.db.Query(`
		SELECT id, platform, platform_user_id 
		FROM platform_accounts 
		WHERE user_id = $1 AND status = 'connected'
	`, userID)
	if err != nil {
		log.Printf("Failed to list accounts for discovery: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var accountID int
		var platform, platformUserID string
		if err := rows.Scan(&accountID, &platform, &platformUserID); err != nil {
			continue
		}

		// Use factory to get service
		svc, err := GetPlatformService(platform, s.db)
		if err != nil {
			continue
		}

		// Fetch recent videos from platform
		externals, err := svc.FetchRecentVideos(accountID)
		if err != nil {
			log.Printf("Failed to fetch recent videos for %s account %d: %v", platform, accountID, err)
			continue
		}

		for _, ev := range externals {
			// 1. Check if this video is already tracked
			var videoID int
			err := s.db.QueryRow(`
				SELECT video_id FROM video_platform_jobs 
				WHERE platform = $1 AND platform_id = $2
			`, platform, ev.ID).Scan(&videoID)

			if err == nil {
				// Already exists, skip
				continue
			}

			// 2. Register as a shadow video in Creati
			// We use a transaction to ensure both records are created
			tx, err := s.db.Begin()
			if err != nil {
				continue
			}

			var newVideoID int
			err = tx.QueryRow(`
				INSERT INTO videos (user_id, title, description, platform, external_id, status)
				VALUES ($1, $2, $3, $4, $5, 'synced')
				RETURNING id
			`, userID, ev.Title, ev.Description, platform, ev.ID).Scan(&newVideoID)

			if err != nil {
				tx.Rollback()
				log.Printf("Failed to insert discovered video: %v", err)
				continue
			}

			_, err = tx.Exec(`
				INSERT INTO video_platform_jobs (video_id, account_id, platform, platform_id, status)
				VALUES ($1, $2, $3, $4, 'completed')
			`, newVideoID, accountID, platform, ev.ID)

			if err != nil {
				tx.Rollback()
				log.Printf("Failed to insert discovery job: %v", err)
				continue
			}

			tx.Commit()
			log.Printf("Discovered and registered external video: %s (%s)", ev.Title, ev.ID)
		}
	}

	// Mark as discovered in cache
	if s.cache != nil {
		s.cache.Set(context.Background(), discoveryKey, "ok", 6*time.Hour)
	}
}
