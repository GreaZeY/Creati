package storage

import (
	"context"
	"io"
)

type StorageProvider interface {
	Upload(ctx context.Context, key string, reader io.Reader, contentType string) error
	GetObjectURL(key string) string
}
