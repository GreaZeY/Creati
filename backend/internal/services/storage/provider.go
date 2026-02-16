package storage

import (
	"context"
	"io"
)

type StorageProvider interface {
	Upload(ctx context.Context, key string, reader io.Reader, contentType string) error
	GetObjectURL(key string) string
	GeneratePresignedURL(key string, contentType string) (string, error)
	Exists(ctx context.Context, key string) (bool, error)
	GetStream(ctx context.Context, key string) (io.ReadCloser, error)
}
