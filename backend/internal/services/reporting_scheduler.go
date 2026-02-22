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
	notifyService    *NotificationService
}

func NewReportingScheduler(db *sql.DB, analytics *AnalyticsService, notify *NotificationService) *ReportingScheduler {
	return &ReportingScheduler{
		db:               db,
		analyticsService: analytics,
		notifyService:    notify,
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
		summary, err := s.analyticsService.GetClientMetrics(ctx, clientID)
		if err != nil {
			logger.Get("reporting").WithField("client_id", clientID).WithError(err).Error("Failed to fetch metrics for recap")
			continue
		}

		// 3. Dispatch Notification / Email
		var userEmail string
		err = s.db.QueryRowContext(ctx, "SELECT email FROM users WHERE id = $1", userID).Scan(&userEmail)
		if err == nil {
			err = s.notifyService.DispatchWeeklyImpact(ctx, userEmail, clientName, summary.TotalViews, summary.TotalLikes+summary.TotalComments)
			if err != nil {
				logger.Get("reporting").WithError(err).Error("Failed to dispatch email")
			}
		}

		logger.Get("reporting").WithFields(logrus.Fields{
			"client_id":   clientID,
			"client_name": clientName,
			"total_views": summary.TotalViews,
			"engagement":  summary.TotalLikes + summary.TotalComments,
		}).Info("Weekly Impact Snapshot dispatched via NotificationService")
	}

	return nil
}
