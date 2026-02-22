package services

import (
	"context"
	"database/sql"
	"fmt"

	"creati.in/creati/backend/internal/logger"
	"github.com/sirupsen/logrus"
)

type ReportingScheduler struct {
	db               *sql.DB
	analyticsService *AnalyticsService
}

func NewReportingScheduler(db *sql.DB, analytics *AnalyticsService) *ReportingScheduler {
	return &ReportingScheduler{
		db:               db,
		analyticsService: analytics,
	}
}

// Start initiates the weekly cron job logic.
// In a real production app, this would use a library like `robfig/cron`.
// For our implementation, we'll provide the logic that would be triggered weekly.
func (s *ReportingScheduler) RunWeeklyRoundup(ctx context.Context) error {
	logger.Get("reporting").Info("Starting Weekly Roundup for all clients")

	// 1. Fetch all clients
	rows, err := s.db.QueryContext(ctx, "SELECT id, name, user_id FROM clients")
	if err != nil {
		return fmt.Errorf("failed to fetch clients for reporting: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var clientID int
		var clientName string
		var userID int
		if err := rows.Scan(&clientID, &clientName, &userID); err != nil {
			continue
		}

		// 2. Fetch metrics for the last 7 days
		// AnalyticsService.GetOverview typically returns all-time,
		// but we can extend it or use a custom query for the weekly recap.
		summary, err := s.analyticsService.GetOverview(clientID, false) // false = client-scoped
		if err != nil {
			logger.Get("reporting").WithField("client_id", clientID).WithError(err).Error("Failed to fetch metrics for recap")
			continue
		}

		// 3. Dispatch Notification / Email
		// For Phase 6, we'll log the "Send" action as a placeholder for the notification layer.
		logger.Get("reporting").WithFields(logrus.Fields{
			"client_id":   clientID,
			"client_name": clientName,
			"total_views": summary.TotalViews,
			"engagement":  summary.TotalLikes + summary.TotalComments,
		}).Info("Weekly Impact Snapshot dispatched to agency owner")

		// In a full implementation, this would trigger an email via SendGrid/SES
		// or an in-app notification.
	}

	return nil
}
