package repositories

import (
	"context"
	"database/sql"
	"fmt"

	"creati.in/creati/backend/internal/db/models"
)

type PostRepository struct {
	db *sql.DB
}

func NewPostRepository(db *sql.DB) *PostRepository {
	return &PostRepository{db: db}
}

func (r *PostRepository) GetGlobalCalendar(ctx context.Context, orgID int, userID int, start, end string) ([]models.CalendarEntry, error) {
	query := `
		SELECT 
			ae.id, 
			ae.content_id, 
			ae.target_platform, 
			ae.status, 
			ae.scheduled_at, 
			ae.scheduled_status,
			c.title,
			cl.id as client_id,
			cl.name as client_name,
			cl.color as client_color
		FROM automation_executions ae
		JOIN contents c ON ae.content_id = c.id
		JOIN clients cl ON ae.client_id = cl.id
		JOIN team_members tm ON cl.org_id = tm.org_id
		WHERE tm.org_id = $1 AND tm.user_id = $2 AND tm.status = 'active'
		  AND ae.scheduled_at IS NOT NULL
	`
	args := []interface{}{orgID, userID}

	if start != "" {
		query += " AND ae.scheduled_at >= $3"
		args = append(args, start)
	}
	if end != "" {
		placeholder := "$3"
		if start != "" {
			placeholder = "$4"
		}
		query += fmt.Sprintf(" AND ae.scheduled_at <= %s", placeholder)
		args = append(args, end)
	}

	query += " ORDER BY ae.scheduled_at ASC"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	entries := make([]models.CalendarEntry, 0)
	for rows.Next() {
		var e models.CalendarEntry
		err := rows.Scan(
			&e.ID, &e.ContentID, &e.Platform, &e.Status,
			&e.ScheduledAt, &e.ScheduledStatus, &e.Title,
			&e.ClientID, &e.ClientName, &e.ClientColor,
		)
		if err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}

	return entries, nil
}

func (r *PostRepository) BatchUpdateStatus(ctx context.Context, orgID int, userID int, ids []string, status string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE automation_executions ae
		SET status = $1, scheduled_status = $2
		FROM clients cl
		JOIN team_members tm ON cl.org_id = tm.org_id
		WHERE ae.client_id = cl.id 
		  AND tm.org_id = $3 AND tm.user_id = $4 AND tm.status = 'active'
		  AND ae.id = ANY($5)
	`, status, status, orgID, userID, ids)

	return err
}

func (r *PostRepository) GetTopPerformingVideos(ctx context.Context, clientID int, limit int) ([]models.TopVideo, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT 
			v.id, v.title, v.thumbnail_url, va.platform, va.views, va.likes, va.comments, v.source_platform
		FROM video_analytics va
		JOIN videos v ON va.video_id = v.id
		WHERE v.client_id = $1
		ORDER BY va.views DESC
		LIMIT $2
	`, clientID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var videos []models.TopVideo
	for rows.Next() {
		var v models.TopVideo
		if err := rows.Scan(&v.ID, &v.Title, &v.ThumbnailURL, &v.Platform, &v.Views, &v.Likes, &v.Comments, &v.SourcePlatform); err != nil {
			return nil, err
		}
		videos = append(videos, v)
	}
	return videos, nil
}
