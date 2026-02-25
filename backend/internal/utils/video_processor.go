package utils

import (
	"context"
	"fmt"
	"path/filepath"

	ffmpeg "github.com/u2takey/ffmpeg-go"
)

type VideoProcessor struct{}

func NewVideoProcessor() *VideoProcessor {
	return &VideoProcessor{}
}

// ProcessingSettings defines the edits to be applied
type ProcessingSettings struct {
	TrimStart *float64        `json:"trim_start"`
	TrimEnd   *float64        `json:"trim_end"`
	Overlays  []OverlayConfig `json:"overlays"`
}

// Trim cuts a video from start (seconds) to end (seconds).
// Returns the path to the trimmed file.
func (vp *VideoProcessor) Trim(ctx context.Context, inputPath string, start, end float64) (string, error) {
	outputPath := inputPath + "_trimmed.mp4"

	// Ensure we don't overwrite input if something goes wrong, though typically we should use temp files
	// Here we append suffix for simplicity in this utility

	err := ffmpeg.Input(inputPath, ffmpeg.KwArgs{"ss": start}).
		Output(outputPath, ffmpeg.KwArgs{"t": end - start, "c": "copy"}). // Fast seek with stream copy
		OverWriteOutput().
		Run()

	if err != nil {
		return "", fmt.Errorf("ffmpeg trim failed: %w", err)
	}

	return outputPath, nil
}

// OverlayConfig defines the text or image overlay properties
type OverlayConfig struct {
	Type  string `json:"type"` // "text" or "image" (for now just text is planned)
	Text  string `json:"text"`
	X     string `json:"x"` // FFmpeg syntax e.g. "(w-text_w)/2"
	Y     string `json:"y"`
	Size  int    `json:"size"`
	Color string `json:"color"`
}

// ApplyOverlays adds text overlays to the video.
// IMPORTANT: This requires re-encoding, so it will be slower than Trim.
func (vp *VideoProcessor) ApplyOverlays(ctx context.Context, inputPath string, overlays []OverlayConfig) (string, error) {
	if len(overlays) == 0 {
		return inputPath, nil
	}

	outputPath := inputPath + "_edited.mp4"

	stream := ffmpeg.Input(inputPath)

	for _, overlay := range overlays {
		if overlay.Type == "text" {
			// Using drawtext filter. Note: This requires fontfile.
			// For this MVP we'll assume a default font is available or use a system font.
			// Windows: C\:/Windows/Fonts/arial.ttf
			fontPath := "C:/Windows/Fonts/arial.ttf"
			// In docker (Linux), this might be /usr/share/fonts/...
			// We should make this configurable or detect OS.

			// Escape text for ffmpeg
			// ... simple escape for now

			// Use generic Filter method as specific wrappers might vary
			stream = stream.Filter("drawtext", ffmpeg.Args{}, ffmpeg.KwArgs{
				"text":      overlay.Text,
				"x":         overlay.X,
				"y":         overlay.Y,
				"fontfile":  fontPath,
				"fontsize":  overlay.Size,
				"fontcolor": overlay.Color,
			})
		}
	}

	err := stream.
		Output(outputPath, ffmpeg.KwArgs{
			"c:v":      "libx264",
			"crf":      18,
			"preset":   "medium",
			"c:a":      "copy",
			"movflags": "+faststart",
		}). // High-quality re-encode with audio copy
		OverWriteOutput().
		Run()

	if err != nil {
		return "", fmt.Errorf("ffmpeg overlay failed: %w", err)
	}

	return outputPath, nil
}

// MergeStreams combines a video-only stream and an audio-only stream into a single file.
// Used for HQ YouTube downloads.
func (vp *VideoProcessor) MergeStreams(ctx context.Context, videoPath, audioPath string) (string, error) {
	outputPath := filepath.Dir(videoPath) + string(filepath.Separator) + "merged_" + filepath.Base(videoPath)

	err := ffmpeg.Output(
		[]*ffmpeg.Stream{
			ffmpeg.Input(videoPath),
			ffmpeg.Input(audioPath),
		},
		outputPath,
		ffmpeg.KwArgs{"c:v": "copy", "c:a": "copy"},
	).
		OverWriteOutput().
		Run()

	if err != nil {
		return "", fmt.Errorf("ffmpeg merge failed: %w", err)
	}

	return outputPath, nil
}

// GetDuration returns the duration of the media in seconds
func (vp *VideoProcessor) GetDuration(inputPath string) (float64, error) {
	probe, err := ffmpeg.Probe(inputPath)
	if err != nil {
		return 0, err
	}
	// Parsing JSON probe output is tedious here without struct.
	// For MVP, if we need it, we can implement it.
	// usually returned as string/json.
	// Leaving plain for now as we might pass duration from frontend.
	_ = probe
	return 0, nil
}

// VerticalCrop center-crops a horizontal video to 9:16 aspect ratio
func (vp *VideoProcessor) VerticalCrop(ctx context.Context, inputPath string) (string, error) {
	outputPath := inputPath + "_916.mp4"

	// crop=ih*9/16:ih:(iw-ih*9/16)/2:0
	// This takes the full height (ih) and crops width to 9/16 of it, centered.
	cropFilter := "crop=ih*9/16:ih:(iw-ih*9/16)/2:0"

	err := ffmpeg.Input(inputPath).
		Filter("crop", ffmpeg.Args{cropFilter}).
		Output(outputPath, ffmpeg.KwArgs{"c:a": "copy", "movflags": "+faststart"}).
		OverWriteOutput().
		Run()

	if err != nil {
		return "", fmt.Errorf("vertical crop failed: %w", err)
	}

	return outputPath, nil
}

// OverlaySubtitles burns stylized text into the video.
// Usually we'd use .ass or .srt, but for automated shorts,
// using drawtext per-segment is faster for small clips.
func (vp *VideoProcessor) OverlaySubtitles(ctx context.Context, inputPath string, transcript string) (string, error) {
	outputPath := inputPath + "_captioned.mp4"

	// For a real app, we'd split transcript into timed segments.
	fontPath := "C:/Windows/Fonts/arialbd.ttf" // Use Bold for shorts

	err := ffmpeg.Input(inputPath).
		Filter("drawtext", ffmpeg.Args{}, ffmpeg.KwArgs{
			"text":       transcript,
			"x":          "(w-text_w)/2",
			"y":          "h*0.8",
			"fontfile":   fontPath,
			"fontsize":   "48",
			"fontcolor":  "yellow", // TikTok style
			"box":        "1",
			"boxcolor":   "black@0.5",
			"boxborderw": "5",
		}).
		Output(outputPath, ffmpeg.KwArgs{"c:a": "copy"}).
		OverWriteOutput().
		Run()

	if err != nil {
		return "", fmt.Errorf("subtitle overlay failed: %w", err)
	}

	return outputPath, nil
}
