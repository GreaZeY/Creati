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
