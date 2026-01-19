package api

import (
	"database/sql"
	"strconv"
	"time"

	"example.com/creati/backend/internal/middleware"
	"example.com/creati/backend/internal/services"
	"example.com/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
)

type VideosHandler struct {
	db *sql.DB
}

func NewVideosHandler(db *sql.DB) *VideosHandler {
	return &VideosHandler{db: db}
}

type VideoListItem struct {
	ID          int       `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	S3URL       string    `json:"s3URL"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"createdAt"`
	JobStatus   string    `json:"jobStatus"` // Aggregated status: 'pending', 'processing', 'completed', 'failed'
}

func (h *VideosHandler) ListVideos(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "User not found")
	}

	rows, err := h.db.Query(`
		SELECT v.id, v.title, v.description, v.s3_url, v.status, v.created_at,
		       COALESCE(
		           (SELECT CASE 
		               WHEN EXISTS (SELECT 1 FROM video_platform_jobs WHERE video_id = v.id AND status = 'failed') THEN 'failed'
		               WHEN EXISTS (SELECT 1 FROM video_platform_jobs WHERE video_id = v.id AND status = 'processing') THEN 'processing'
		               WHEN NOT EXISTS (SELECT 1 FROM video_platform_jobs WHERE video_id = v.id AND status != 'completed') THEN 'completed'
		               ELSE 'pending'
		           END), 
		           'pending'
		       ) as job_status
		FROM videos v
		WHERE v.user_id = $1
		ORDER BY v.created_at DESC
	`, userID)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to fetch videos")
	}
	defer rows.Close()

	videos := []VideoListItem{}
	for rows.Next() {
		var v VideoListItem
		if err := rows.Scan(&v.ID, &v.Title, &v.Description, &v.S3URL, &v.Status, &v.CreatedAt, &v.JobStatus); err != nil {
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to parse videos")
		}
		videos = append(videos, v)
	}

	return utils.SuccessResponse(c, videos, "")
}

func (h *VideosHandler) GetVideoStatus(c *fiber.Ctx) error {
	videoID, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Invalid video ID")
	}

	userID := middleware.GetUserID(c)
	if userID == 0 {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "User not found")
	}

	// Verify ownership
	var exists bool
	err = h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM videos WHERE id = $1 AND user_id = $2)", videoID, userID).Scan(&exists)
	if err != nil || !exists {
		return utils.ErrorResponse(c, fiber.StatusNotFound, "Video not found")
	}

	rows, err := h.db.Query(`
		SELECT platform, status, platform_id, retry_count, error_msg, updated_at
		FROM video_platform_jobs
		WHERE video_id = $1
	`, videoID)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to fetch job statuses")
	}
	defer rows.Close()

	type JobStatus struct {
		Platform   string    `json:"platform"`
		Status     string    `json:"status"`
		PlatformID *string   `json:"platformId"`
		RetryCount int       `json:"retryCount"`
		ErrorMsg   *string   `json:"errorMsg"`
		UpdatedAt  time.Time `json:"updatedAt"`
	}

	jobs := []JobStatus{}
	for rows.Next() {
		var j JobStatus
		if err := rows.Scan(&j.Platform, &j.Status, &j.PlatformID, &j.RetryCount, &j.ErrorMsg, &j.UpdatedAt); err != nil {
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to parse job statuses")
		}
		jobs = append(jobs, j)
	}

	return utils.SuccessResponse(c, jobs, "")
}

func (h *VideosHandler) GetVideoAnalytics(c *fiber.Ctx) error {
	videoID, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Invalid video ID")
	}

	userID := middleware.GetUserID(c)
	if userID == 0 {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "User not found")
	}

	// Verify ownership
	var exists bool
	err = h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM videos WHERE id = $1 AND user_id = $2)", videoID, userID).Scan(&exists)
	if err != nil || !exists {
		return utils.ErrorResponse(c, fiber.StatusNotFound, "Video not found")
	}

	// 1. Get latest analytics from DB
	type AnalyticsSnapshot struct {
		Views     int64     `json:"views"`
		Likes     int64     `json:"likes"`
		Comments  int64     `json:"comments"`
		FetchedAt time.Time `json:"fetchedAt"`
	}

	var latest AnalyticsSnapshot
	err = h.db.QueryRow(`
		SELECT views, likes, comments, fetched_at 
		FROM video_analytics 
		WHERE video_id = $1 
		ORDER BY fetched_at DESC LIMIT 1
	`, videoID).Scan(&latest.Views, &latest.Likes, &latest.Comments, &latest.FetchedAt)

	// 2. If data is stale (> 1 hour) or missing, fetch from platform
	if err == sql.ErrNoRows || time.Since(latest.FetchedAt) > 1*time.Hour {
		// Get platform jobs to find platform and platform_id
		rows, err := h.db.Query("SELECT platform, platform_id FROM video_platform_jobs WHERE video_id = $1 AND status = 'completed'", videoID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var platform, platformID string
				if err := rows.Scan(&platform, &platformID); err == nil && platformID != "" {
					// Fetch and Save
					h.RefreshPlatformAnalytics(videoID, platform, platformID)
				}
			}
		}

		// Re-fetch latest after refresh (simplified)
		_ = h.db.QueryRow(`
			SELECT views, likes, comments, fetched_at 
			FROM video_analytics 
			WHERE video_id = $1 
			ORDER BY fetched_at DESC LIMIT 1
		`, videoID).Scan(&latest.Views, &latest.Likes, &latest.Comments, &latest.FetchedAt)
	}

	// 3. Get history for charts (last 30 snapshots)
	historyRows, err := h.db.Query(`
		SELECT views, likes, comments, fetched_at 
		FROM video_analytics 
		WHERE video_id = $1 
		ORDER BY fetched_at ASC LIMIT 30
	`, videoID)

	history := []AnalyticsSnapshot{}
	if err == nil {
		defer historyRows.Close()
		for historyRows.Next() {
			var s AnalyticsSnapshot
			if err := historyRows.Scan(&s.Views, &s.Likes, &s.Comments, &s.FetchedAt); err == nil {
				history = append(history, s)
			}
		}
	}

	return utils.SuccessResponse(c, fiber.Map{
		"current": latest,
		"history": history,
	}, "")
}

// RefreshPlatformAnalytics internal helper
func (h *VideosHandler) RefreshPlatformAnalytics(videoID int, platform string, platformID string) {
	// Get platform service using factory
	platformService, err := services.GetPlatformService(platform, h.db)
	if err != nil {
		return
	}

	// Fetch analytics from platform
	stats, err := platformService.FetchAnalytics(platformID)
	if err != nil {
		return
	}

	// Save to DB
	_, _ = h.db.Exec(`
		INSERT INTO video_analytics (video_id, platform, views, likes, comments)
		VALUES ($1, $2, $3, $4, $5)
	`, videoID, platform, stats.Views, stats.Likes, stats.Comments)
}
