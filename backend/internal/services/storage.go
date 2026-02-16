package services

import (
	"context"
	"io"
	"os"

	"creati.in/creati/backend/internal/services/storage"
)

type StorageService struct {
	Provider storage.StorageProvider
}

func NewStorageService() (*StorageService, error) {
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
		Provider: provider,
	}, nil
}

func (s *StorageService) Upload(ctx context.Context, key string, reader io.Reader, contentType string) error {
	return s.Provider.Upload(ctx, key, reader, contentType)
}

func (s *StorageService) GetObjectURL(key string) string {
	return s.Provider.GetObjectURL(key)
}

func (s *StorageService) GeneratePresignedURL(key string, contentType string) (string, error) {
	return s.Provider.GeneratePresignedURL(key, contentType)
}

func (s *StorageService) Exists(ctx context.Context, key string) (bool, error) {
	return s.Provider.Exists(ctx, key)
}

func (s *StorageService) GetStream(ctx context.Context, key string) (io.ReadCloser, error) {
	return s.Provider.GetStream(ctx, key)
}
