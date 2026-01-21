package services

import (
	"database/sql"
	"log"
	"time"
)

// AnalyticsService handles efficient stats gathering and caching
type AnalyticsService struct {
	db *sql.DB
}

func NewAnalyticsService(db *sql.DB) *AnalyticsService {
	return &AnalyticsService{db: db}
}

// UserStats represents aggregated user metrics
type UserStats struct {
	TotalVideos   int   `json:"totalVideos"`
	TotalViews    int64 `json:"totalViews"`
	TotalLikes    int64 `json:"totalLikes"`
	TotalComments int64 `json:"totalComments"`
	TotalShares   int64 `json:"totalShares"`
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
	stats := &UserStats{}

	// Query the optimized view
	err := s.db.QueryRow(`
		SELECT total_videos, total_views, total_likes, total_comments, total_shares
		FROM vw_user_stats WHERE user_id = $1
	`, userID).Scan(
		&stats.TotalVideos, &stats.TotalViews, &stats.TotalLikes, &stats.TotalComments, &stats.TotalShares,
	)

	if err == sql.ErrNoRows {
		return &UserStats{}, nil // Return empty stats for new users
	}
	if err != nil {
		return nil, err
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
	// Find all videos for user
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
