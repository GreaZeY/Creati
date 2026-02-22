package services

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"creati.in/creati/backend/internal/logger"
)

type RecyclingService struct {
	db *sql.DB
}

func NewRecyclingService(db *sql.DB) *RecyclingService {
	return &RecyclingService{db: db}
}

type EvergreenContent struct {
	VideoID      int       `json:"videoId"`
	Title        string    `json:"title"`
	TotalViews   int64     `json:"totalViews"`
	Platform     string    `json:"platform"`
	CreatedAt    time.Time `json:"createdAt"`
	ExternalID   string    `json:"externalId"`
	RecycleScore float64   `json:"recycleScore"`
}

type SuggestedPost struct {
	ID           int       `json:"id"`
	VideoID      int       `json:"videoId"`
	Title        string    `json:"title"`
	Platform     string    `json:"platform"`
	ScheduledFor time.Time `json:"scheduledFor"`
	RecycleScore float64   `json:"recycleScore"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"createdAt"`
}

// GetEvergreenSuggestions finds content in the top 10% of performance for a client
func (s *RecyclingService) GetEvergreenSuggestions(ctx context.Context, clientID int, limit int) ([]EvergreenContent, error) {
	query := `
		WITH Metrics AS (
			SELECT 
				v.id, 
				v.title, 
				v.created_at,
				va.views,
				va.platform,
				va.platform_content_id as external_id,
				PERCENT_RANK() OVER (PARTITION BY va.platform ORDER BY va.views DESC) as rank
			FROM videos v
			JOIN video_analytics va ON v.id = va.video_id
			WHERE v.client_id = $1
		)
		SELECT id, title, views, platform, created_at, external_id
		FROM Metrics
		WHERE rank <= 0.1 -- Top 10%
		ORDER BY views DESC
		LIMIT $2
	`

	rows, err := s.db.QueryContext(ctx, query, clientID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch evergreen suggestions: %w", err)
	}
	defer rows.Close()

	var results []EvergreenContent
	for rows.Next() {
		var c EvergreenContent
		if err := rows.Scan(&c.VideoID, &c.Title, &c.TotalViews, &c.Platform, &c.CreatedAt, &c.ExternalID); err != nil {
			continue
		}
		results = append(results, c)
	}

	return results, nil
}

// ScanAndSuggest identifies top-performing content that hasn't been recycled recently
// and inserts suggestion records into suggested_posts. Safe to run repeatedly.
func (s *RecyclingService) ScanAndSuggest(ctx context.Context) error {
	log := logger.Get("evergreen")
	log.Info("Running Evergreen scan...")

	// Find high-performers not posted (as a new upload job) in the last 30 days,
	// excluding content that already has a pending suggestion.
	query := `
		WITH scored AS (
			SELECT
				v.id      AS video_id,
				v.user_id,
				v.client_id,
				v.title,
				va.platform,
				COALESCE(MAX(va.views), 0) AS total_views,
				-- Recycle score: views normalised 0–1 + staleness bonus for content >60 days old
				(
					COALESCE(MAX(va.views), 0)::float / NULLIF((SELECT MAX(views) FROM video_analytics), 0)
					+ LEAST(EXTRACT(EPOCH FROM (NOW() - v.created_at)) / 86400.0 / 60.0, 1.0) * 0.3
				) AS recycle_score,
				PERCENT_RANK() OVER (PARTITION BY v.user_id, va.platform ORDER BY MAX(va.views) DESC) AS rank
			FROM videos v
			JOIN video_analytics va ON v.id = va.video_id
			WHERE v.status IN ('completed', 'synced')
			  AND v.created_at < NOW() - INTERVAL '30 days'
			  AND NOT EXISTS (
				SELECT 1 FROM video_platform_jobs vpj
				WHERE vpj.video_id = v.id AND vpj.created_at > NOW() - INTERVAL '30 days'
			  )
			  AND NOT EXISTS (
				SELECT 1 FROM suggested_posts sp
				WHERE sp.video_id = v.id AND sp.status = 'pending'
			  )
			GROUP BY v.id, v.user_id, v.client_id, v.title, va.platform
		)
		SELECT video_id, user_id, client_id, title, platform, recycle_score
		FROM scored
		WHERE rank <= 0.1
		LIMIT 50
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("evergreen scan query failed: %w", err)
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var videoID, userID int
		var clientID sql.NullInt64
		var title, platform string
		var score float64

		if err := rows.Scan(&videoID, &userID, &clientID, &title, &platform, &score); err != nil {
			continue
		}

		// Suggest scheduling 7 days from now at 10:00 AM
		scheduledFor := time.Now().AddDate(0, 0, 7).Truncate(24 * time.Hour).Add(10 * time.Hour)

		_, err := s.db.ExecContext(ctx, `
			INSERT INTO suggested_posts (user_id, client_id, video_id, title, platform, scheduled_for, recycle_score, status)
			VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
		`, userID, clientID, videoID, title, platform, scheduledFor, score)

		if err != nil {
			log.WithError(err).Warn("Failed to insert suggestion")
			continue
		}
		count++
	}

	log.Infof("Evergreen scan complete: %d new suggestions created", count)
	return nil
}

// ListSuggestions returns pending suggestions for a user (and optionally a client)
func (s *RecyclingService) ListSuggestions(ctx context.Context, userID int, clientID *int) ([]SuggestedPost, error) {
	query := `
		SELECT id, video_id, title, platform, scheduled_for, recycle_score, status, created_at
		FROM suggested_posts
		WHERE user_id = $1 AND status = 'pending'
	`
	args := []interface{}{userID}
	if clientID != nil {
		query += " AND client_id = $2"
		args = append(args, *clientID)
	}
	query += " ORDER BY recycle_score DESC LIMIT 20"

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list suggestions: %w", err)
	}
	defer rows.Close()

	suggestions := make([]SuggestedPost, 0)
	for rows.Next() {
		var s SuggestedPost
		if err := rows.Scan(&s.ID, &s.VideoID, &s.Title, &s.Platform, &s.ScheduledFor, &s.RecycleScore, &s.Status, &s.CreatedAt); err != nil {
			continue
		}
		suggestions = append(suggestions, s)
	}

	return suggestions, nil
}

// UpdateSuggestionStatus changes the status of a suggestion (approved / dismissed)
func (s *RecyclingService) UpdateSuggestionStatus(ctx context.Context, id int, userID int, status string) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE suggested_posts SET status = $1
		WHERE id = $2 AND user_id = $3
	`, status, id, userID)
	if err != nil {
		return fmt.Errorf("failed to update suggestion status: %w", err)
	}
	return nil
}
