package workers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"creati.in/creati/backend/internal/db/models"
	"creati.in/creati/backend/internal/services"
	"creati.in/creati/backend/internal/utils"
)

type ShortsJob struct {
	VideoID int `json:"video_id"`
}

type ShortsWorker struct {
	BaseWorker
	DB             *sql.DB
	AISvc          *services.AIService
	StorageSvc     *services.StorageService
	VideoProcessor *utils.VideoProcessor
}

func NewShortsWorker(db *sql.DB, queueSvc *services.QueueService, aiSvc *services.AIService, storageSvc *services.StorageService) *ShortsWorker {
	return &ShortsWorker{
		BaseWorker:     BaseWorker{QueueSvc: queueSvc},
		DB:             db,
		AISvc:          aiSvc,
		StorageSvc:     storageSvc,
		VideoProcessor: utils.NewVideoProcessor(),
	}
}

func (w *ShortsWorker) Name() string  { return "ShortsWorker" }
func (w *ShortsWorker) Queue() string { return services.QueueShortsGeneration }

func (w *ShortsWorker) Process(ctx context.Context, payload []byte) error {
	var job ShortsJob
	if err := json.Unmarshal(payload, &job); err != nil {
		return fmt.Errorf("failed to unmarshal shorts job: %w", err)
	}

	// 1. Fetch Video
	var video models.Video
	err := w.DB.QueryRowContext(ctx, "SELECT id, s3_url, user_id, client_id, title FROM videos WHERE id = $1", job.VideoID).
		Scan(&video.ID, &video.S3URL, &video.UserID, &video.ClientID, &video.Title)
	if err != nil {
		return fmt.Errorf("failed to fetch video: %w", err)
	}

	// 2. Download to local temp
	tempDir, _ := os.MkdirTemp("", "shorts_*")
	defer os.RemoveAll(tempDir)
	localInput := filepath.Join(tempDir, "input.mp4")

	stream, err := w.StorageSvc.GetStream(ctx, video.S3URL)
	if err != nil {
		return fmt.Errorf("failed to get stream: %w", err)
	}
	defer stream.Close()

	file, _ := os.Create(localInput)
	defer file.Close()
	_, _ = io.Copy(file, stream)

	// 3. Transcribe
	transcript, err := w.AISvc.TranscribeVideo(ctx, localInput)
	if err != nil {
		return fmt.Errorf("transcription failed: %w", err)
	}

	// 4. Analyze Segments
	segments, err := w.AISvc.AnalyzeViralSegments(ctx, transcript)
	if err != nil {
		return fmt.Errorf("segment analysis failed: %w", err)
	}

	// 5. Generate Shorts
	for i, seg := range segments {
		// Trim -> Crop -> Subtitle
		trimmed, _ := w.VideoProcessor.Trim(ctx, localInput, seg.Start, seg.End)
		cropped, _ := w.VideoProcessor.VerticalCrop(ctx, trimmed)
		final, _ := w.VideoProcessor.OverlaySubtitles(ctx, cropped, seg.Hook)

		// Upload
		shortKey := fmt.Sprintf("shorts/%d/short_%d.mp4", video.ID, i)
		f, _ := os.Open(final)
		w.StorageSvc.Upload(ctx, shortKey, f, "video/mp4")
		f.Close()

		// Save to DB
		_, _ = w.DB.ExecContext(ctx, `
			INSERT INTO videos (user_id, client_id, title, description, s3_url, status, parent_id, is_short)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, video.UserID, video.ClientID, seg.Hook, seg.Topic, shortKey, "completed", video.ID, true)
	}

	return nil
}
