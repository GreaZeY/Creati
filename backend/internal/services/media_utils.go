package services

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strings"

	"creati.in/creati/backend/internal/utils"
)

// MediaVariant represents a specific quality/format of a video on a platform
type MediaVariant struct {
	URL      string
	Height   int
	Bitrate  int
	MimeType string
	HasAudio bool
	HasVideo bool
	Metadata any // Platform-specific metadata (e.g. *youtube_dl.Format)
}

// DownloaderFunc defines the signature for platform-specific download logic
type DownloaderFunc func(ctx context.Context, variant *MediaVariant, destPath string) error

// SelectBestVariant picks the highest resolution variant under the MaxDownloadHeight limit
func SelectBestVariant(variants []MediaVariant, mimeFilter string) *MediaVariant {
	var filtered []MediaVariant
	for _, v := range variants {
		// Respect global resolution cap
		if v.Height > MaxDownloadHeight {
			continue
		}

		if mimeFilter != "" && !strings.Contains(v.MimeType, mimeFilter) {
			continue
		}

		// Ensure it's a video track (unless we are specifically looking for audio)
		if mimeFilter == "" || strings.Contains(mimeFilter, "video") {
			if v.Height == 0 {
				continue
			}
		}

		filtered = append(filtered, v)
	}

	if len(filtered) == 0 {
		return nil
	}

	// Sort by Height (desc), then Bitrate (desc)
	sort.Slice(filtered, func(i, j int) bool {
		if filtered[i].Height != filtered[j].Height {
			return filtered[i].Height > filtered[j].Height
		}
		return filtered[i].Bitrate > filtered[j].Bitrate
	})

	return &filtered[0]
}

// DownloadVariantToFile downloads a single variant to the destination path
func DownloadVariantToFile(ctx context.Context, variant *MediaVariant, destPath string) error {
	req, err := http.NewRequestWithContext(ctx, "GET", variant.URL, nil)
	if err != nil {
		return err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to download variant: status %d", resp.StatusCode)
	}

	out, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	return err
}

// OrchestrateHQMerge handles downloading separate video/audio tracks and merging them
func OrchestrateHQMerge(ctx context.Context, videoVar, audioVar *MediaVariant, destPath string, downloader DownloaderFunc) error {
	vTempPath := destPath + ".video.tmp"
	aTempPath := destPath + ".audio.tmp"

	// Download video
	if err := downloader(ctx, videoVar, vTempPath); err != nil {
		return err
	}
	defer os.Remove(vTempPath)

	// Download audio
	if err := downloader(ctx, audioVar, aTempPath); err != nil {
		return err
	}
	defer os.Remove(aTempPath)

	// Merge using VideoProcessor
	vp := utils.NewVideoProcessor()
	merged, err := vp.MergeStreams(ctx, vTempPath, aTempPath)
	if err != nil {
		return err
	}

	return utils.MoveFile(merged, destPath)
}
