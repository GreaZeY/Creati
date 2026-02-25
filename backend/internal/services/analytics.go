package services

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"creati.in/creati/backend/internal/db/models"
	"creati.in/creati/backend/internal/logger"
	"github.com/sirupsen/logrus"
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
	TotalVideos       int               `json:"totalVideos"`
	TotalViews        int64             `json:"totalViews"`
	TotalLikes        int64             `json:"totalLikes"`
	TotalComments     int64             `json:"totalComments"`
	TotalShares       int64             `json:"totalShares"`
	PlatformBreakdown []PlatformStat    `json:"platformBreakdown"`
	ProjectedRevenue  float64           `json:"projectedRevenue"`
	PulseData         []PulsePoint      `json:"pulseData"`
	TopVideos         []models.TopVideo `json:"topVideos"`
}

type PulsePoint struct {
	Date       string `json:"name"` // e.g. "Mon" or "01-30"
	Reach      int64  `json:"reach"`
	Engagement int64  `json:"engagement"`
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

// GetClientMetrics fetches aggregated stats for a specific client (public or private)
func (s *AnalyticsService) GetClientMetrics(ctx context.Context, clientID int) (*UserStats, error) {
	stats := &UserStats{
		PlatformBreakdown: []PlatformStat{},
		PulseData:         []PulsePoint{},
		TopVideos:         []models.TopVideo{},
	}

	// 1. Get core aggregates
	query := "SELECT total_videos, total_views, total_likes, total_comments, total_shares FROM vw_user_stats WHERE client_id = $1"
	err := s.db.QueryRowContext(ctx, query, clientID).Scan(
		&stats.TotalVideos, &stats.TotalViews, &stats.TotalLikes, &stats.TotalComments, &stats.TotalShares,
	)

	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	// 2. Fetch platform breakdown for this client
	pbQuery := `
		SELECT platform, COALESCE(SUM(views), 0)
		FROM (
			SELECT DISTINCT ON (video_id, account_id) platform, views
			FROM video_analytics
			WHERE video_id IN (SELECT id FROM videos WHERE client_id = $1)
			ORDER BY video_id, account_id, fetched_at DESC
		) t GROUP BY platform
	`
	rows, err := s.db.QueryContext(ctx, pbQuery, clientID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var p PlatformStat
			if err := rows.Scan(&p.Platform, &p.Views); err == nil {
				stats.PlatformBreakdown = append(stats.PlatformBreakdown, p)
			}
		}
	}

	// 3. Pulse Data (last 30 days for reporting)
	pulse, err := s.GetGrowthPulse(0, &clientID) // Pass 0 as userID since we filter by clientID
	if err == nil {
		stats.PulseData = pulse
	}

	// 4. Top Videos
	rows, err = s.db.QueryContext(ctx, `
		SELECT 
			v.id, v.title, v.thumbnail_url, va.platform, va.views, va.likes, va.comments, v.source_platform
		FROM video_analytics va
		JOIN videos v ON va.video_id = v.id
		WHERE v.client_id = $1
		ORDER BY va.views DESC
		LIMIT 5
	`, clientID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var v models.TopVideo
			if err := rows.Scan(&v.ID, &v.Title, &v.ThumbnailURL, &v.Platform, &v.Views, &v.Likes, &v.Comments, &v.SourcePlatform); err == nil {
				stats.TopVideos = append(stats.TopVideos, v)
			}
		}
	}

	return stats, nil
}

// GetUserStats fetches aggregated stats from view (Fast)
func (s *AnalyticsService) GetUserStats(userID int, clientID *int) (*UserStats, error) {
	stats := &UserStats{
		PlatformBreakdown: []PlatformStat{},
		PulseData:         []PulsePoint{},
		TopVideos:         []models.TopVideo{},
	}

	// 1. Core aggregates
	query := "SELECT total_videos, total_views, total_likes, total_comments, total_shares FROM vw_user_stats WHERE user_id = $1"
	args := []interface{}{userID}
	if clientID != nil {
		query += " AND client_id = $2"
		args = append(args, *clientID)
	} else {
		query += " AND client_id IS NULL"
	}

	err := s.db.QueryRow(query, args...).Scan(
		&stats.TotalVideos, &stats.TotalViews, &stats.TotalLikes, &stats.TotalComments, &stats.TotalShares,
	)

	if err != nil && err != sql.ErrNoRows {
		logger.Get("analytics").WithFields(logrus.Fields{
			"error":     err,
			"user_id":   userID,
			"client_id": clientID,
		}).Error("GetUserStats failed")
		return nil, err
	}

	// 2. Fetch platform breakdown
	pbQuery := `
		SELECT platform, COALESCE(SUM(views), 0)
		FROM (
			SELECT DISTINCT ON (video_id, account_id) platform, views
			FROM video_analytics
			WHERE video_id IN (SELECT id FROM videos WHERE user_id = $1
	`
	pbArgs := []interface{}{userID}
	if clientID != nil {
		pbQuery += " AND client_id = $2"
		pbArgs = append(pbArgs, *clientID)
	} else {
		pbQuery += " AND client_id IS NULL"
	}
	pbQuery += `)
			ORDER BY video_id, account_id, fetched_at DESC
		) latest_per_account
		GROUP BY platform`

	rows, err := s.db.Query(pbQuery, pbArgs...)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var p PlatformStat
			if err := rows.Scan(&p.Platform, &p.Views); err == nil {
				p.Revenue = float64(p.Views) * 0.002
				stats.PlatformBreakdown = append(stats.PlatformBreakdown, p)
				stats.ProjectedRevenue += p.Revenue
			}
		}
	}

	// 3. Pulse Data (last 7 days)
	pulse, err := s.GetGrowthPulse(userID, clientID)
	if err == nil {
		stats.PulseData = pulse
	}

	return stats, nil
}

// GetOrgStats fetches aggregated stats for all clients in the user's organizations
func (s *AnalyticsService) GetOrgStats(userID int) (*UserStats, error) {
	stats := &UserStats{
		PlatformBreakdown: []PlatformStat{},
		PulseData:         []PulsePoint{},
		TopVideos:         []models.TopVideo{},
	}

	// 1. Core aggregates across all clients the user has access to
	query := `
		SELECT 
			COUNT(DISTINCT v.id) as total_videos,
			COALESCE(SUM(latest.views), 0) as total_views,
			COALESCE(SUM(latest.likes), 0) as total_likes,
			COALESCE(SUM(latest.comments), 0) as total_comments,
			COALESCE(SUM(latest.shares), 0) as total_shares
		FROM (
			SELECT DISTINCT ON (va.video_id, va.account_id) va.video_id, va.views, va.likes, va.comments, va.shares
			FROM video_analytics va
			JOIN videos v ON va.video_id = v.id
			JOIN clients c ON v.client_id = c.id
			JOIN team_members tm ON c.org_id = tm.org_id
			WHERE tm.user_id = $1 AND tm.status = 'active'
			ORDER BY va.video_id, va.account_id, va.fetched_at DESC
		) latest
		JOIN videos v ON latest.video_id = v.id
	`
	err := s.db.QueryRow(query, userID).Scan(
		&stats.TotalVideos, &stats.TotalViews, &stats.TotalLikes, &stats.TotalComments, &stats.TotalShares,
	)

	if err != nil && err != sql.ErrNoRows {
		logger.Get("analytics").WithError(err).Error("GetOrgStats failed")
		return nil, err
	}

	// 2. Fetch platform breakdown for all clients
	pbQuery := `
		SELECT platform, COALESCE(SUM(views), 0)
		FROM (
			SELECT DISTINCT ON (va.video_id, va.account_id) va.platform, va.views
			FROM video_analytics va
			JOIN videos v ON va.video_id = v.id
			JOIN clients c ON v.client_id = c.id
			JOIN team_members tm ON c.org_id = tm.org_id
			WHERE tm.user_id = $1 AND tm.status = 'active'
			ORDER BY va.video_id, va.account_id, va.fetched_at DESC
		) latest_per_account
		GROUP BY platform`

	rows, err := s.db.Query(pbQuery, userID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var p PlatformStat
			if err := rows.Scan(&p.Platform, &p.Views); err == nil {
				p.Revenue = float64(p.Views) * 0.002
				stats.PlatformBreakdown = append(stats.PlatformBreakdown, p)
				stats.ProjectedRevenue += p.Revenue
			}
		}
	}

	// 3. Pulse Data (Org Global)
	pulse, err := s.GetOrgGrowthPulse(userID)
	if err == nil {
		stats.PulseData = pulse
	}

	return stats, nil
}

// GetGrowthPulse fetches time-series data for the last 7 days
func (s *AnalyticsService) GetGrowthPulse(userID int, clientID *int) ([]PulsePoint, error) {
	gpQuery := `
		WITH RECURSIVE days AS (
			SELECT DATE_TRUNC('day', NOW()) as day
			UNION ALL
			SELECT day - INTERVAL '1 day'
			FROM days
			WHERE day > DATE_TRUNC('day', NOW()) - INTERVAL '6 days'
		),
		daily_snaps AS (
			SELECT 
				DATE_TRUNC('day', fetched_at) as day,
				video_id,
				account_id,
				MAX(views) as max_views,
				MAX(likes + comments + shares) as max_engagement
			FROM video_analytics
			WHERE video_id IN (SELECT id FROM videos WHERE user_id = $1
	`
	gpArgs := []interface{}{userID}
	if clientID != nil {
		gpQuery += " AND client_id = $2"
		gpArgs = append(gpArgs, *clientID)
	} else {
		gpQuery += " AND client_id IS NULL"
	}

	gpQuery += `)
			  AND fetched_at > NOW() - INTERVAL '7 days'
			GROUP BY 1, 2, 3
		),
		summed_daily AS (
			SELECT 
				d.day,
				COALESCE(SUM(s.max_views), 0) as reach,
				COALESCE(SUM(s.max_engagement), 0) as engagement
			FROM days d
			LEFT JOIN daily_snaps s ON d.day = s.day
			GROUP BY 1
			ORDER BY 1 ASC
		)
		SELECT 
			TO_CHAR(day, 'Dy') as name,
			reach,
			engagement
		FROM summed_daily`

	rows, err := s.db.Query(gpQuery, gpArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pulse := make([]PulsePoint, 0)
	for rows.Next() {
		var p PulsePoint
		if err := rows.Scan(&p.Date, &p.Reach, &p.Engagement); err == nil {
			pulse = append(pulse, p)
		}
	}

	return pulse, nil
}

// GetOrgGrowthPulse fetches time-series data for all clients in org
func (s *AnalyticsService) GetOrgGrowthPulse(userID int) ([]PulsePoint, error) {
	gpQuery := `
		WITH RECURSIVE days AS (
			SELECT DATE_TRUNC('day', NOW()) as day
			UNION ALL
			SELECT day - INTERVAL '1 day'
			FROM days
			WHERE day > DATE_TRUNC('day', NOW()) - INTERVAL '6 days'
		),
		daily_snaps AS (
			SELECT 
				DATE_TRUNC('day', va.fetched_at) as day,
				va.video_id,
				va.account_id,
				MAX(va.views) as max_views,
				MAX(va.likes + va.comments + va.shares) as max_engagement
			FROM video_analytics va
			JOIN videos v ON va.video_id = v.id
			JOIN clients c ON v.client_id = c.id
			JOIN team_members tm ON c.org_id = tm.org_id
			WHERE tm.user_id = $1 AND tm.status = 'active'
			  AND va.fetched_at > NOW() - INTERVAL '7 days'
			GROUP BY 1, 2, 3
		),
		summed_daily AS (
			SELECT 
				d.day,
				COALESCE(SUM(s.max_views), 0) as reach,
				COALESCE(SUM(s.max_engagement), 0) as engagement
			FROM days d
			LEFT JOIN daily_snaps s ON d.day = s.day
			GROUP BY 1
			ORDER BY 1 ASC
		)
		SELECT 
			TO_CHAR(day, 'Dy') as name,
			reach,
			engagement
		FROM summed_daily`

	rows, err := s.db.Query(gpQuery, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pulse := make([]PulsePoint, 0)
	for rows.Next() {
		var p PulsePoint
		if err := rows.Scan(&p.Date, &p.Reach, &p.Engagement); err == nil {
			pulse = append(pulse, p)
		}
	}

	return pulse, nil
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
func (s *AnalyticsService) SyncUserAnalytics(userID int, clientID *int) {
	// Discovery skipped for now to focus on direct analytics if needed,
	// or update Discovery to support clientID as well.

	query := "SELECT id FROM videos WHERE user_id = $1"
	args := []interface{}{userID}
	if clientID != nil {
		query += " AND client_id = $2"
		args = append(args, *clientID)
	} else {
		query += " AND client_id IS NULL"
	}

	rows, err := s.db.Query(query, args...)
	if err != nil {
		logger.Get("analytics").WithError(err).Error("Failed to list videos for sync")
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
			logger.Get("analytics").WithFields(logrus.Fields{
				"platform":   platform,
				"video_id":   platformID,
				"account_id": accountID,
				"error":      err,
			}).Error("Failed to fetch analytics")
			continue
		}

		// 5. Insert snapshot
		_, err = s.db.Exec(`
			INSERT INTO video_analytics (video_id, account_id, platform, views, likes, comments, shares)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, videoID, accountID, platform, stats.Views, stats.Likes, stats.Comments, stats.Shares)

		if err != nil {
			logger.Get("analytics").WithError(err).Error("Failed to save analytics snapshot")
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
			logger.Get("analytics").WithField("user_id", userID).Debug("Discovery throttle: Skipping (already ran recently)")
			return
		}
	}

	// Find all connected accounts for user
	rows, err := s.db.Query(`
		SELECT id, platform, platform_user_id 
		FROM platform_accounts 
		WHERE user_id = $1 AND status IN ('active', 'connected')
	`, userID)
	if err != nil {
		logger.Get("analytics").WithError(err).Error("Failed to list accounts for discovery")
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
			logger.Get("analytics").WithFields(logrus.Fields{
				"platform":   platform,
				"account_id": accountID,
				"error":      err,
			}).Error("Failed to fetch recent videos")
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
				INSERT INTO videos (user_id, title, description, source_platform, platform_id, status, s3_url)
				VALUES ($1, $2, $3, $4, $5, 'synced', 'external')
				RETURNING id
			`, userID, ev.Title, ev.Description, platform, ev.ID).Scan(&newVideoID)

			if err != nil {
				tx.Rollback()
				logger.Get("analytics").WithError(err).Error("Failed to insert discovered video")
				continue
			}

			_, err = tx.Exec(`
				INSERT INTO video_platform_jobs (video_id, account_id, platform, platform_id, status)
				VALUES ($1, $2, $3, $4, 'completed')
			`, newVideoID, accountID, platform, ev.ID)

			if err != nil {
				tx.Rollback()
				logger.Get("analytics").WithError(err).Error("Failed to insert discovery job")
				continue
			}

			tx.Commit()
			logger.Get("analytics").WithFields(logrus.Fields{
				"title": ev.Title,
				"id":    ev.ID,
			}).Info("Discovered and registered external video")
		}
	}

	// Mark as discovered in cache
	if s.cache != nil {
		s.cache.Set(context.Background(), discoveryKey, "ok", 6*time.Hour)
	}
}
