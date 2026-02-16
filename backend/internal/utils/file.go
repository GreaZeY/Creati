package utils

import (
	"io"
	"os"
)

// CopyFile copies a file from src to dst.
func CopyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

// MoveFile attempts to rename (move) a file from src to dst.
// If renaming fails (e.g., cross-device), it falls back to Copy and Delete.
func MoveFile(src, dst string) error {
	err := os.Rename(src, dst)
	if err == nil {
		return nil
	}

	// Fallback to copy and delete if rename fails
	if err := CopyFile(src, dst); err != nil {
		return err
	}

	return os.Remove(src)
}
