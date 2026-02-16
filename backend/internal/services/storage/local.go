package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

type LocalProvider struct {
	BaseDir string
	BaseURL string
}

func NewLocalProvider() (*LocalProvider, error) {
	baseDir := "storage"
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, err
	}

	baseURL := os.Getenv("DEV_PUBLIC_URL")
	if baseURL == "" {
		baseURL = os.Getenv("LOCAL_STORAGE_BASE_URL")
	}
	if baseURL == "" {
		baseURL = "http://localhost:8080"
	}

	// Append /storage suffix if not present
	if !strings.HasSuffix(baseURL, "/storage") {
		baseURL = strings.TrimSuffix(baseURL, "/") + "/storage"
	}

	return &LocalProvider{
		BaseDir: baseDir,
		BaseURL: baseURL,
	}, nil
}

func (l *LocalProvider) Upload(ctx context.Context, key string, reader io.Reader, contentType string) error {
	path := filepath.Join(l.BaseDir, key)
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}

	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = io.Copy(file, reader)
	return err
}

func (l *LocalProvider) GetObjectURL(key string) string {
	return fmt.Sprintf("%s/%s", l.BaseURL, key)
}

func (l *LocalProvider) Exists(ctx context.Context, key string) (bool, error) {
	path := filepath.Join(l.BaseDir, key)
	_, err := os.Stat(path)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, err
}

func (l *LocalProvider) GeneratePresignedURL(key string, contentType string) (string, error) {
	// For local, we return a direct upload endpoint if we had one,
	// or just a path that the frontend knows how to POST to.
	// For now, since we have a single-node setup, we return the target URL
	// and the frontend can use our UploadMedia handler.
	return fmt.Sprintf("%s/%s", l.BaseURL, key), nil
}

func (l *LocalProvider) GetStream(ctx context.Context, key string) (io.ReadCloser, error) {
	path := filepath.Join(l.BaseDir, key)
	return os.Open(path)
}
