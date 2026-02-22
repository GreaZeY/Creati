package services

import (
	"context"

	"creati.in/creati/backend/internal/db/models"
	"creati.in/creati/backend/internal/db/repositories"
)

type PostService struct {
	repo *repositories.PostRepository
}

func NewPostService(repo *repositories.PostRepository) *PostService {
	return &PostService{repo: repo}
}

func (s *PostService) GetGlobalCalendar(ctx context.Context, orgID int, userID int, start, end string) ([]models.CalendarEntry, error) {
	return s.repo.GetGlobalCalendar(ctx, orgID, userID, start, end)
}

func (s *PostService) BatchUpdateStatus(ctx context.Context, orgID int, userID int, ids []string, status string) error {
	// Add business logic validation here if needed (e.g. status transition rules)
	return s.repo.BatchUpdateStatus(ctx, orgID, userID, ids, status)
}
