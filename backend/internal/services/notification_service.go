package services

import (
	"context"
	"database/sql"
	"fmt"

	"creati.in/creati/backend/internal/logger"
	"github.com/sirupsen/logrus"
)

type NotificationService struct {
	db *sql.DB
}

func NewNotificationService(db *sql.DB) *NotificationService {
	return &NotificationService{db: db}
}

func (s *NotificationService) SendEmail(ctx context.Context, to string, subject string, body string) error {
	// Mock email sending
	logger.Get("notify").WithFields(logrus.Fields{
		"to":      to,
		"subject": subject,
	}).Info("MOCK EMAIL SENT")

	// We could also log the body if needed for debugging
	// logger.Get("notify").Debug(body)

	return nil
}

func (s *NotificationService) SendSystemAlert(ctx context.Context, userID int, title string, message string) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO notifications (user_id, title, message)
		VALUES ($1, $2, $3)
	`, userID, title, message)

	if err != nil {
		logger.Get("notify").WithError(err).Error("Failed to persist system alert")
		return err
	}

	logger.Get("notify").WithFields(logrus.Fields{
		"user_id": userID,
		"title":   title,
	}).Info("System Alert Persisted")

	return nil
}

func (s *NotificationService) DispatchWeeklyImpact(ctx context.Context, to string, clientName string, views int64, engagement int64) error {
	subject := fmt.Sprintf("Weekly Impact Report: %s", clientName)
	body := fmt.Sprintf(`
		<h1>Your Weekly Impact Summary</h1>
		<p>Hi there!</p>
		<p>Here is how <strong>%s</strong> performed this week:</p>
		<ul>
			<li><strong>Total Reach:</strong> %d views</li>
			<li><strong>engagement:</strong> %d interactions</li>
		</ul>
		<p>Keep up the great work!</p>
		<p>Best,<br/>The Creati Team</p>
	`, clientName, views, engagement)

	return s.SendEmail(ctx, to, subject, body)
}
