package utils

import (
	"fmt"
	"io"
	"net/http"
	"os"
)

// DownloadToTempFile downloads content from a URL to a temporary file on disk.
// It returns the *os.File (which is seeked to the beginning) and its path.
// The caller is responsible for closing and removing the file.
func DownloadToTempFile(url string) (*os.File, error) {
	// Create temp file
	tmpFile, err := os.CreateTemp("", "creati-download-*.tmp")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}

	// Fetch from URL
	resp, err := http.Get(url)
	if err != nil {
		tmpFile.Close()
		os.Remove(tmpFile.Name())
		return nil, fmt.Errorf("failed to fetch URL: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		tmpFile.Close()
		os.Remove(tmpFile.Name())
		return nil, fmt.Errorf("URL returned status %d", resp.StatusCode)
	}

	// Stream to file
	_, err = io.Copy(tmpFile, resp.Body)
	if err != nil {
		tmpFile.Close()
		os.Remove(tmpFile.Name())
		return nil, fmt.Errorf("failed to write to temp file: %w", err)
	}

	// Seek to beginning for subsequent reads
	if _, err := tmpFile.Seek(0, 0); err != nil {
		tmpFile.Close()
		os.Remove(tmpFile.Name())
		return nil, fmt.Errorf("failed to seek temp file: %w", err)
	}

	return tmpFile, nil
}
