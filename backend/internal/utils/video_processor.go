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
	TrimStart   *float64           `json:"trim_start"`
	TrimEnd     *float64           `json:"trim_end"`
	Overlays    []OverlayConfig    `json:"overlays"`
	AudioTracks []AudioTrackConfig `json:"audio_tracks"`
	Transitions []TransitionConfig `json:"transitions"`
}

// AudioTrackConfig defines background music properties
type AudioTrackConfig struct {
	URL       string  `json:"url"`
	StartTime float64 `json:"start_time"` // At what point in project to start
	Duration  float64 `json:"duration"`
	Volume    float64 `json:"volume"` // 0.0 to 1.0 (or higher for boost)
	FadeIn    float64 `json:"fade_in"`
	FadeOut   float64 `json:"fade_out"`
}

// TransitionConfig defines visual effects between clips or for intro/outro
type TransitionConfig struct {
	Type     string  `json:"type"` // "fade", "wipe", etc.
	Duration float64 `json:"duration"`
	Offset   float64 `json:"offset"` // Point in timeline
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

// MixAudio layers multiple audio tracks onto the video
func (vp *VideoProcessor) MixAudio(ctx context.Context, inputPath string, tracks []AudioTrackConfig) (string, error) {
	if len(tracks) == 0 {
		return inputPath, nil
	}

	outputPath := inputPath + "_mixed.mp4"

	// Construct complex amix filter
	// This is sophisticated and usually requires building a custom filter string
	// For each track: [input]atrim=duration=D,adelay=S|S,volume=V[outN]
	// Then: [0:a][out1]...amix=inputs=N+1:duration=first:dropout_transition=3[aout]

	var inputs []*ffmpeg.Stream
	inputs = append(inputs, ffmpeg.Input(inputPath))

	for _, t := range tracks {
		inputs = append(inputs, ffmpeg.Input(t.URL))
	}

	// For simplicity in this implementation using the ffmpeg-go wrapper,
	// we will construct a high-level command if possible, or use raw args.
	// Since amix is complex, we use a more direct approach.

	err := ffmpeg.Input(inputPath).
		Output(outputPath, ffmpeg.KwArgs{"c:v": "copy"}). // Placeholder for logic logic
		OverWriteOutput().
		Run()

	// Real implementation would use FilterGraph for precise mixing.
	// We'll implementation this in a more robust way in the unified processor.

	return outputPath, err
}

// ProcessCreativeProject applies all edits in a single pass where possible
func (vp *VideoProcessor) ProcessCreativeProject(ctx context.Context, inputPath string, settings ProcessingSettings) (string, error) {
	outputPath := inputPath + "_studio.mp4"

	stream := ffmpeg.Input(inputPath)

	// 1. Trim
	if settings.TrimStart != nil || settings.TrimEnd != nil {
		start := 0.0
		if settings.TrimStart != nil {
			start = *settings.TrimStart
		}
		stream = stream.Filter("trim", ffmpeg.Args{}, ffmpeg.KwArgs{"start": start})
		if settings.TrimEnd != nil {
			stream = stream.Filter("atrim", ffmpeg.Args{}, ffmpeg.KwArgs{"end": *settings.TrimEnd})
		}
		stream = stream.Filter("setpts", ffmpeg.Args{"PTS-STARTPTS"})
	}

	// 2. Overlays (Visual)
	for _, overlay := range settings.Overlays {
		if overlay.Type == "text" {
			fontPath := "C:/Windows/Fonts/arial.ttf"
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

	// 3. Audio Construction
	// We'll use a multi-input approach here
	allInputs := []*ffmpeg.Stream{stream}
	for _, t := range settings.AudioTracks {
		allInputs = append(allInputs, ffmpeg.Input(t.URL))
	}

	// Final Render
	err := ffmpeg.Output(allInputs, outputPath, ffmpeg.KwArgs{
		"c:v": "libx264",
		"crf": 18,
		"c:a": "aac",
	}).OverWriteOutput().Run()

	if err != nil {
		return "", err
	}

	return outputPath, nil
}
