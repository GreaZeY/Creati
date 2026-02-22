package services

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

type RecyclingService struct {
	db *sql.DB
}

func NewRecyclingService(db *sql.DB) *RecyclingService {
	return &RecyclingService{db: db}
}

type EvergreenContent struct {
	VideoID    int       `json:"videoId"`
	Title      string    `json:"title"`
	TotalViews int64     `json:"totalViews"`
	Platform   string    `json:"platform"`
	CreatedAt  time.Time `json:"createdAt"`
	ExternalID string    `json:"externalId"`
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
