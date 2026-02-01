package repositories

import (
	"context"
	"database/sql"

	"creati.in/creati/backend/internal/db/models"
)

// PlatformRepository handles all database operations for platform accounts
type PlatformRepository struct {
	db *sql.DB
}

// NewPlatformRepository creates a new PlatformRepository instance
func NewPlatformRepository(db *sql.DB) *PlatformRepository {
	return &PlatformRepository{db: db}
}

// UpsertAccount inserts or updates a platform account
func (r *PlatformRepository) UpsertAccount(ctx context.Context, account *models.PlatformAccount) error {
	query := `
		INSERT INTO platform_accounts (user_id, platform, access_token, refresh_token, platform_user_id, status, profile_name, handle, email, webhook_url)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (user_id, platform, platform_user_id) 
		DO UPDATE SET 
			access_token = $3, 
			refresh_token = $4,
			status = $6, 
			profile_name = $7, 
			handle = $8,
			email = $9,
			webhook_url = $10,
			connected_at = NOW()
	`
	_, err := r.db.ExecContext(ctx, query,
		account.UserID,
		account.Platform,
		account.AccessToken,
		account.RefreshToken,
		account.PlatformUserID,
		account.Status,
		account.ProfileName,
		account.Handle,
		account.Email,
		account.WebhookURL,
	)
	return err
}

// GetAccount retrieves a platform account for a user
func (r *PlatformRepository) GetAccount(ctx context.Context, accountID int) (*models.PlatformAccount, error) {
	var acc models.PlatformAccount
	query := `
		SELECT id, user_id, platform, access_token, refresh_token, platform_user_id, status, profile_name, handle, email, webhook_url, connected_at
		FROM platform_accounts WHERE id = $1
	`
	err := r.db.QueryRowContext(ctx, query, accountID).Scan(
		&acc.ID, &acc.UserID, &acc.Platform, &acc.AccessToken, &acc.RefreshToken,
		&acc.PlatformUserID, &acc.Status, &acc.ProfileName, &acc.Handle, &acc.Email, &acc.WebhookURL, &acc.ConnectedAt,
	)
	if err != nil {
		return nil, err
	}
	return &acc, nil
}
