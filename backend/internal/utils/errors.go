package utils

import "errors"

/**
 * Custom error types for categorization
 * Following Single Responsibility - each error type has clear meaning
 */

var (
	ErrNotFound         = errors.New("resource not found")
	ErrUnauthorized     = errors.New("unauthorized")
	ErrInvalidInput     = errors.New("invalid input")
	ErrPlatformNotFound = errors.New("platform not found")
	ErrUploadFailed     = errors.New("upload failed")
	ErrDatabaseError    = errors.New("database error")
)

// WrapError wraps an error with context
func WrapError(err error, context string) error {
	if err == nil {
		return nil
	}
	return errors.New(context + ": " + err.Error())
}
