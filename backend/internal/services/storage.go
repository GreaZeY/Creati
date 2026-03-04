package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"io"
	"os"

	"creati.in/creati/backend/internal/features"
	"creati.in/creati/backend/internal/services/storage"
)

type StorageService struct {
	db              *sql.DB
	defaultProvider storage.StorageProvider
}

func NewStorageService(db *sql.DB) (*StorageService, error) {
	driver := os.Getenv("STORAGE_DRIVER")
	if driver == "" {
		driver = "local"
	}

	var provider storage.StorageProvider
	var err error

	switch driver {
	case "local":
		provider, err = storage.NewLocalProvider()
	case "s3":
		provider, err = storage.NewS3Provider()
	default:
		provider, err = storage.NewLocalProvider()
	}

	if err != nil {
		return nil, err
	}

	return &StorageService{
		db:              db,
		defaultProvider: provider,
	}, nil
}

// GetProvider returns the appropriate storage provider for an organization
func (s *StorageService) GetProvider(ctx context.Context, orgID int) (storage.StorageProvider, error) {
	// 1. Check if org has BYO storage enabled and plan allows it
	var plan string
	err := s.db.QueryRowContext(ctx, `
		SELECT s.plan 
		FROM subscriptions s 
		JOIN organizations o ON s.user_id = o.owner_id 
		WHERE o.id = $1
	`, orgID).Scan(&plan)

	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	if features.HasFeature(plan, features.CanUseAdvancedAnalytics) { // Using this as a proxy for Pro for now, or add new feature
		var providerType string
		var creds json.RawMessage
		err = s.db.QueryRowContext(ctx, `
			SELECT provider_type, credentials 
			FROM organization_storage_configs 
			WHERE org_id = $1 AND is_active = TRUE
		`, orgID).Scan(&providerType, &creds)

		if err == nil {
			// Resolve custom provider
			switch providerType {
			case "s3_custom":
				// Parse creds for custom S3
				// For now, reuse default if it's S3, or ideally create new S3 provider with these creds
				return s.defaultProvider, nil
			case "gdrive":
				var config struct {
					Credentials []byte `json:"creds"`
					FolderID    string `json:"folder_id"`
				}
				if err := json.Unmarshal(creds, &config); err == nil {
					return storage.NewGoogleDriveProvider(config.Credentials, config.FolderID)
				}
			case "dropbox":
				var config struct {
					Token string `json:"token"`
					Path  string `json:"path"`
				}
				if err := json.Unmarshal(creds, &config); err == nil {
					return storage.NewDropboxProvider(config.Token, config.Path), nil
				}
			}
		}
	}

	return s.defaultProvider, nil
}

func (s *StorageService) Upload(ctx context.Context, key string, reader io.Reader, contentType string) error {
	return s.defaultProvider.Upload(ctx, key, reader, contentType)
}

func (s *StorageService) GetObjectURL(key string) string {
	return s.defaultProvider.GetObjectURL(key)
}

func (s *StorageService) GeneratePresignedURL(key string, contentType string) (string, error) {
	return s.defaultProvider.GeneratePresignedURL(key, contentType)
}

func (s *StorageService) Exists(ctx context.Context, key string) (bool, error) {
	return s.defaultProvider.Exists(ctx, key)
}

func (s *StorageService) GetStream(ctx context.Context, key string) (io.ReadCloser, error) {
	return s.defaultProvider.GetStream(ctx, key)
}
