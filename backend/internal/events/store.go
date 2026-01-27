package events

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

var (
	ErrDuplicateEvent = errors.New("duplicate event detected")
	ErrEventNotFound  = errors.New("event not found")
)

// Store handles all database operations for platform events
type Store struct {
	db *sql.DB
}

// NewStore creates a new event store
func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

// CreateEvent inserts a new event with idempotency via dedup_key
func (s *Store) CreateEvent(ctx context.Context, event *NormalizedEvent) error {
	payloadJSON, err := json.Marshal(event.Payload)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO platform_events (
			id, platform, event_type, external_id, account_id,
			payload, occurred_at, received_at, status, dedup_key, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	_, err = s.db.ExecContext(ctx, query,
		event.ID,
		event.Platform,
		event.EventType,
		event.ExternalID,
		event.AccountID,
		payloadJSON,
		event.OccurredAt,
		event.ReceivedAt,
		event.Status,
		event.DedupKey,
		event.CreatedAt,
	)

	if err != nil {
		// Check for unique constraint violation
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			return ErrDuplicateEvent
		}
		return err
	}

	return nil
}

// GetEventByID retrieves a single event
func (s *Store) GetEventByID(ctx context.Context, id uuid.UUID) (*NormalizedEvent, error) {
	query := `
		SELECT id, platform, event_type, external_id, account_id,
		       payload, occurred_at, received_at, status, dedup_key,
		       processed_at, error, created_at
		FROM platform_events
		WHERE id = $1
	`

	var event NormalizedEvent
	var payloadJSON []byte

	err := s.db.QueryRowContext(ctx, query, id).Scan(
		&event.ID,
		&event.Platform,
		&event.EventType,
		&event.ExternalID,
		&event.AccountID,
		&payloadJSON,
		&event.OccurredAt,
		&event.ReceivedAt,
		&event.Status,
		&event.DedupKey,
		&event.ProcessedAt,
		&event.Error,
		&event.CreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, ErrEventNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(payloadJSON, &event.Payload); err != nil {
		return nil, err
	}

	return &event, nil
}

// GetPendingEvents retrieves all events with status='pending' for processing
func (s *Store) GetPendingEvents(ctx context.Context, limit int) ([]*NormalizedEvent, error) {
	query := `
		SELECT id, platform, event_type, external_id, account_id,
		       payload, occurred_at, received_at, status, dedup_key,
		       processed_at, error, created_at
		FROM platform_events
		WHERE status = $1
		ORDER BY occurred_at ASC
		LIMIT $2
	`

	rows, err := s.db.QueryContext(ctx, query, EventStatusPending, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []*NormalizedEvent
	for rows.Next() {
		var event NormalizedEvent
		var payloadJSON []byte

		err := rows.Scan(
			&event.ID,
			&event.Platform,
			&event.EventType,
			&event.ExternalID,
			&event.AccountID,
			&payloadJSON,
			&event.OccurredAt,
			&event.ReceivedAt,
			&event.Status,
			&event.DedupKey,
			&event.ProcessedAt,
			&event.Error,
			&event.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		if err := json.Unmarshal(payloadJSON, &event.Payload); err != nil {
			return nil, err
		}

		events = append(events, &event)
	}

	return events, rows.Err()
}

// MarkEventProcessed updates event status to 'processed'
func (s *Store) MarkEventProcessed(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE platform_events
		SET status = $1, processed_at = $2
		WHERE id = $3
	`

	_, err := s.db.ExecContext(ctx, query, EventStatusProcessed, time.Now(), id)
	return err
}

// MarkEventFailed updates event status to 'failed' with error message
func (s *Store) MarkEventFailed(ctx context.Context, id uuid.UUID, errMsg string) error {
	query := `
		UPDATE platform_events
		SET status = $1, error = $2
		WHERE id = $3
	`

	_, err := s.db.ExecContext(ctx, query, EventStatusFailed, errMsg, id)
	return err
}

// ListEvents retrieves events with pagination and optional filters
func (s *Store) ListEvents(ctx context.Context, accountID *int, platform *string, limit, offset int) ([]*NormalizedEvent, error) {
	query := `
		SELECT id, platform, event_type, external_id, account_id,
		       payload, occurred_at, received_at, status, dedup_key,
		       processed_at, error, created_at
		FROM platform_events
		WHERE ($1::int IS NULL OR account_id = $1)
		  AND ($2::text IS NULL OR platform = $2)
		ORDER BY occurred_at DESC
		LIMIT $3 OFFSET $4
	`

	rows, err := s.db.QueryContext(ctx, query, accountID, platform, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []*NormalizedEvent
	for rows.Next() {
		var event NormalizedEvent
		var payloadJSON []byte

		err := rows.Scan(
			&event.ID,
			&event.Platform,
			&event.EventType,
			&event.ExternalID,
			&event.AccountID,
			&payloadJSON,
			&event.OccurredAt,
			&event.ReceivedAt,
			&event.Status,
			&event.DedupKey,
			&event.ProcessedAt,
			&event.Error,
			&event.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		if err := json.Unmarshal(payloadJSON, &event.Payload); err != nil {
			return nil, err
		}

		events = append(events, &event)
	}

	return events, rows.Err()
}

// ResetEventForRetry resets a failed event back to pending status for replay
func (s *Store) ResetEventForRetry(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE platform_events
		SET status = $1, processed_at = NULL, error = NULL
		WHERE id = $2
	`

	result, err := s.db.ExecContext(ctx, query, EventStatusPending, id)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrEventNotFound
	}

	return nil
}
