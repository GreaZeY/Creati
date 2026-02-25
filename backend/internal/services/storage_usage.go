package services

import (
	"context"
	"database/sql"
	"fmt"
)

type StorageUsageService struct {
	db *sql.DB
}

func NewStorageUsageService(db *sql.DB) *StorageUsageService {
	return &StorageUsageService{db: db}
}

// GetUsedSpace returns total bytes used by an organization
func (s *StorageUsageService) GetUsedSpace(ctx context.Context, orgID int) (int64, error) {
	var used int64
	err := s.db.QueryRowContext(ctx, "SELECT storage_used_bytes FROM organizations WHERE id = $1", orgID).Scan(&used)
	if err != nil {
		return 0, err
	}
	return used, nil
}

// CheckQuota verifies if the organization has enough space for a new file
func (s *StorageUsageService) CheckQuota(ctx context.Context, orgID int, fileSize int64) error {
	var used int64
	var quotaGB int
	var plan string

	// Fetch used space, quota, and plan
	err := s.db.QueryRowContext(ctx, `
		SELECT o.storage_used_bytes, o.storage_quota_gb, s.plan
		FROM organizations o
		LEFT JOIN subscriptions s ON o.owner_id = s.user_id
		WHERE o.id = $1
	`, orgID).Scan(&used, &quotaGB, &plan)

	if err != nil {
		return fmt.Errorf("failed to fetch storage info: %w", err)
	}

	// If BYO Storage is active, we might skip this check or use a different logic.
	// For now, assume this is for Creati-managed storage.

	limitBytes := int64(quotaGB) * 1024 * 1024 * 1024
	if used+fileSize > limitBytes {
		return fmt.Errorf("storage quota exceeded (%d GB limit)", quotaGB)
	}

	return nil
}

// UpdateUsage increments the storage usage for an organization
func (s *StorageUsageService) UpdateUsage(ctx context.Context, orgID int, bytes int64) error {
	_, err := s.db.ExecContext(ctx, "UPDATE organizations SET storage_used_bytes = storage_used_bytes + $1 WHERE id = $2", bytes, orgID)
	return err
}

// SyncUsage recalculates storage usage from the videos table
func (s *StorageUsageService) SyncUsage(ctx context.Context, orgID int) error {
	var total int64
	err := s.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(size_bytes), 0)
		FROM videos v
		JOIN clients c ON v.client_id = c.id
		WHERE c.org_id = $1 AND v.is_guest = FALSE -- Only count non-guest if you want, or all. Usually all.
	`, orgID).Scan(&total)

	if err != nil {
		return err
	}

	_, err = s.db.ExecContext(ctx, "UPDATE organizations SET storage_used_bytes = $1 WHERE id = $2", total, orgID)
	return err
}
