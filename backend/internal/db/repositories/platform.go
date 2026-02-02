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
		INSERT INTO platform_accounts (user_id, client_id, platform, access_token, refresh_token, platform_user_id, status, profile_name, handle, email, webhook_url)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (user_id, platform, platform_user_id, (COALESCE(client_id, 0))) 
		DO UPDATE SET 
			access_token = $4, 
			refresh_token = $5,
			status = $7, 
			profile_name = $8, 
			handle = $9,
			email = $10,
			webhook_url = $11,
			connected_at = NOW()
	`
	_, err := r.db.ExecContext(ctx, query,
		account.UserID,
		account.ClientID, // Nullable pointer
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
	// Include client_id in key scan
	query := `
		SELECT id, user_id, client_id, platform, access_token, refresh_token, platform_user_id, status, profile_name, handle, email, webhook_url, connected_at
		FROM platform_accounts WHERE id = $1
	`
	err := r.db.QueryRowContext(ctx, query, accountID).Scan(
		&acc.ID, &acc.UserID, &acc.ClientID, &acc.Platform, &acc.AccessToken, &acc.RefreshToken,
		&acc.PlatformUserID, &acc.Status, &acc.ProfileName, &acc.Handle, &acc.Email, &acc.WebhookURL, &acc.ConnectedAt,
	)
	if err != nil {
		return nil, err
	}
	return &acc, nil
}

// ListAccounts retrieves platform accounts for a user, properly filtered by Workspace (Client)
// If clientID is nil, it fetches "Personal" workspace accounts (where client_id IS NULL)
func (r *PlatformRepository) ListAccounts(ctx context.Context, userID int, clientID *int) ([]models.PlatformAccount, error) {
	query := `
		SELECT id, user_id, client_id, platform, access_token, refresh_token, platform_user_id, status, profile_name, handle, email, webhook_url, connected_at
		FROM platform_accounts 
		WHERE user_id = $1
	`
	args := []interface{}{userID}

	if clientID != nil {
		query += " AND client_id = $2"
		args = append(args, *clientID)
	}

	query += " ORDER BY platform ASC, profile_name ASC"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []models.PlatformAccount
	for rows.Next() {
		var acc models.PlatformAccount
		if err := rows.Scan(
			&acc.ID, &acc.UserID, &acc.ClientID, &acc.Platform, &acc.AccessToken, &acc.RefreshToken,
			&acc.PlatformUserID, &acc.Status, &acc.ProfileName, &acc.Handle, &acc.Email, &acc.WebhookURL, &acc.ConnectedAt,
		); err != nil {
			return nil, err
		}
		accounts = append(accounts, acc)
	}

	return accounts, nil
}
