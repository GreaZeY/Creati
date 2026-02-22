package services

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

type ReportingService struct {
	db           *sql.DB
	analyticsSvc *AnalyticsService
}

func NewReportingService(db *sql.DB, analytics *AnalyticsService) *ReportingService {
	return &ReportingService{
		db:           db,
		analyticsSvc: analytics,
	}
}

type ClientReport struct {
	ClientName    string         `json:"clientName"`
	GeneratedAt   time.Time      `json:"generatedAt"`
	TimeRange     string         `json:"timeRange"`
	BrandColor    string         `json:"brandColor"`
	LogoUrl       string         `json:"logoUrl"`
	Summary       ReportSummary  `json:"summary"`
	Platforms     []PlatformStat `json:"platforms"`
	TopPerforming []VideoReport  `json:"topPerforming"`
}

type ReportSummary struct {
	TotalReach      int64   `json:"totalReach"`
	TotalEngagement int64   `json:"totalEngagement"`
	Efficiency      float64 `json:"efficiency"` // Engagement per 1000 views
	GrowthRate      float64 `json:"growthRate"`
}

type VideoReport struct {
	Title      string    `json:"title"`
	Platform   string    `json:"platform"`
	Views      int64     `json:"views"`
	Engagement int64     `json:"engagement"`
	Published  time.Time `json:"published"`
}

// GenerateMonthlyReport aggregates data for a specific client over the last 30 days
func (s *ReportingService) GenerateMonthlyReport(ctx context.Context, userID int, clientID int) (*ClientReport, error) {
	// 1. Get client brand info
	var report ClientReport
	err := s.db.QueryRowContext(ctx, `
		SELECT name, COALESCE(color, '#6366f1'), COALESCE(logo_url, '')
		FROM clients WHERE id = $1
	`, clientID).Scan(&report.ClientName, &report.BrandColor, &report.LogoUrl)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch client info: %w", err)
	}

	report.GeneratedAt = time.Now()
	report.TimeRange = "Last 30 Days"

	// 2. Get Analytics stats for this client
	stats, err := s.analyticsSvc.GetUserStats(userID, &clientID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch analytics: %w", err)
	}

	report.Summary = ReportSummary{
		TotalReach:      stats.TotalViews,
		TotalEngagement: stats.TotalLikes + stats.TotalComments + stats.TotalShares,
	}

	if report.Summary.TotalReach > 0 {
		report.Summary.Efficiency = float64(report.Summary.TotalEngagement) / float64(report.Summary.TotalReach) * 1000
	}

	report.Platforms = stats.PlatformBreakdown

	// 3. Get Top performing content
	topQuery := `
		SELECT v.title, va.platform, va.views, (va.likes + va.comments + va.shares) as engagement, v.created_at
		FROM video_analytics va
		JOIN videos v ON va.video_id = v.id
		WHERE v.client_id = $1 AND va.fetched_at > NOW() - INTERVAL '30 days'
		ORDER BY va.views DESC
		LIMIT 5
	`
	rows, err := s.db.QueryContext(ctx, topQuery, clientID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var vr VideoReport
			if err := rows.Scan(&vr.Title, &vr.Platform, &vr.Views, &vr.Engagement, &vr.Published); err == nil {
				report.TopPerforming = append(report.TopPerforming, vr)
			}
		}
	}

	return &report, nil
}
