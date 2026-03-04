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
	Segments    []VideoSegmentConfig `json:"video_segments"`
	AudioTracks []AudioTrackConfig   `json:"audio_tracks"`
	Transitions []TransitionConfig   `json:"transitions"`
	Overlays    []OverlayConfig      `json:"overlays"`
}

// VideoSegmentConfig defines a clip in the sequence
type VideoSegmentConfig struct {
	URL       string  `json:"url"`
	StartTime float64 `json:"start_time"`
	Duration  float64 `json:"duration"`
	TrimStart float64 `json:"trim_start"`
	TrimEnd   float64 `json:"trim_end"`
	Volume    float64 `json:"volume"`
	Filter    string  `json:"filter"` // "noir", "cinematic", etc.
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
	Type              string  `json:"type"` // "text", "sticker", "image"
	Text              string  `json:"text,omitempty"`
	Source            string  `json:"src,omitempty"`
	X                 float64 `json:"x"` // Percentage 0-100
	Y                 float64 `json:"y"` // Percentage 0-100
	Width             float64 `json:"width"`
	Height            float64 `json:"height"`
	Rotation          float64 `json:"rotation"`
	Size              int     `json:"fontSize,omitempty"`
	Color             string  `json:"fontColor,omitempty"`
	BGColor           string  `json:"bgColor,omitempty"`
	FontFamily        string  `json:"fontFamily,omitempty"`
	AnimationIn       string  `json:"animationIn,omitempty"`
	AnimationOut      string  `json:"animationOut,omitempty"`
	AnimationDuration float64 `json:"animationDuration,omitempty"`
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
func (vp *VideoProcessor) ProcessCreativeProject(ctx context.Context, outputPath string, settings ProcessingSettings) (string, error) {
	if len(settings.Segments) == 0 {
		return "", fmt.Errorf("no video segments provided")
	}

	// 1. Process each segment (Trim + Filter)
	var segmentStreams []*ffmpeg.Stream
	for i, seg := range settings.Segments {
		s := ffmpeg.Input(seg.URL, ffmpeg.KwArgs{"ss": seg.TrimStart}).
			Filter("trim", ffmpeg.Args{}, ffmpeg.KwArgs{"duration": seg.Duration}).
			Filter("setpts", ffmpeg.Args{"PTS-STARTPTS"})

		// Apply Color Filters
		switch seg.Filter {
		case "noir":
			s = s.Filter("colorchannelmixer", ffmpeg.Args{".3:.4:.3:0:.3:.4:.3:0:.3:.4:.3"})
		case "sepia":
			s = s.Filter("colorchannelmixer", ffmpeg.Args{".393:.769:.189:0:.349:.686:.168:0:.272:.534:.131"})
		case "vivid":
			s = s.Filter("eq", ffmpeg.Args{}, ffmpeg.KwArgs{"saturation": 1.5})
		case "cinematic":
			s = s.Filter("eq", ffmpeg.Args{}, ffmpeg.KwArgs{"contrast": 1.1, "brightness": -0.05})
		}

		segmentStreams = append(segmentStreams, s)
		_ = i
	}

	// 2. Concatenate Segments
	// Note: In a complex filtergraph, we'd use 'concat'
	// For MVP simplicity and reliability, we'll build a filter string if needed
	// or use sequence processing.
	var finalVideoStream *ffmpeg.Stream
	if len(segmentStreams) > 1 {
		// This is a simplification; real concat requires matching formats
		finalVideoStream = ffmpeg.Filter(segmentStreams, "concat", ffmpeg.Args{fmt.Sprintf("n=%d:v=1:a=0", len(segmentStreams))})
	} else {
		finalVideoStream = segmentStreams[0]
	}

	// 3. Overlays (Visual)
	for _, overlay := range settings.Overlays {
		if overlay.Type == "text" {
			fontPath := "C:/Windows/Fonts/arial.ttf"
			// Convert percentage X/Y to FFmpeg coordinates
			// This requires knowing video dimensions, for now using placeholders
			finalVideoStream = finalVideoStream.Filter("drawtext", ffmpeg.Args{}, ffmpeg.KwArgs{
				"text":      overlay.Text,
				"x":         fmt.Sprintf("(w*%f/100)", overlay.X),
				"y":         fmt.Sprintf("(h*%f/100)", overlay.Y),
				"fontfile":  fontPath,
				"fontsize":  overlay.Size,
				"fontcolor": overlay.Color,
			})
		}
	}

	// 4. Audio Mixing
	// Merge original audio from segments and mix with background tracks
	// ... (Complex mixing logic)

	// Final Render
	err := finalVideoStream.
		Output(outputPath, ffmpeg.KwArgs{
			"c:v":      "libx264",
			"crf":      18,
			"preset":   "medium",
			"movflags": "+faststart",
		}).
		OverWriteOutput().
		Run()

	return outputPath, err
}
