package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"creati.in/creati/backend/internal/types"
)

type LiveImageConfig struct{ BaseURL, APIKey, Model, Size string }

func LiveImageEnvironment() LiveImageConfig {
	return LiveImageConfig{BaseURL: os.Getenv("YOUTUBE_LIVE_IMAGE_BASE_URL"), APIKey: os.Getenv("YOUTUBE_LIVE_IMAGE_API_KEY"), Model: os.Getenv("YOUTUBE_LIVE_IMAGE_MODEL"), Size: os.Getenv("YOUTUBE_LIVE_IMAGE_SIZE")}
}

type LiveImageGenerator struct {
	config LiveImageConfig
	client *http.Client
	slots  chan struct{}
}

func NewLiveImageGenerator(config LiveImageConfig, client *http.Client) *LiveImageGenerator {
	if client == nil {
		client = &http.Client{Timeout: 150 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	}
	if config.Size == "" {
		config.Size = "1536x1024"
	}
	return &LiveImageGenerator{config: config, client: client, slots: make(chan struct{}, 1)}
}
func (g *LiveImageGenerator) Ready() bool {
	u, err := url.Parse(g.config.BaseURL)
	return err == nil && (u.Scheme == "https" || u.Scheme == "http") && u.Host != "" && u.User == nil && g.config.APIKey != "" && g.config.Model != ""
}
func (g *LiveImageGenerator) Generate(ctx context.Context, d *types.LiveDraft) ([]byte, error) {
	if !g.Ready() {
		return nil, fmt.Errorf("configure an image-capable model route on the server")
	}
	if d.Package == nil {
		return nil, fmt.Errorf("prepare the researched package first")
	}
	select {
	case g.slots <- struct{}{}:
		defer func() { <-g.slots }()
	default:
		return nil, fmt.Errorf("thumbnail generator is busy; retry shortly")
	}
	concept, _ := json.Marshal(d.Package.Thumbnail)
	prompt := `Create a polished YouTube Live thumbnail as a deliberate title/image pair. Use a single clear focal subject and small-screen legibility. Keep important content inside a centered 16:9 crop of this landscape image. Use the researched direction below, not generic gaming hype. Represent the planned activity truthfully. Do not invent real gameplay screenshots, result/score/rank screens, a victory, a real person's face/reaction, endorsements, or evidence. Without a supplied real screenshot use an obviously illustrative promotional composition rather than fake gameplay. If text is useful, use only the specified short overlay, accurately spelled; do not repeat the full title. No logos implying an official endorsement. No unrelated trending elements.
Stream idea: ` + d.Idea + "\nCreator context: " + d.Context + "\nTitle: " + d.Package.Title.Text + "\nViewer promise: " + d.Package.Title.Promise + "\nThumbnail direction: " + string(concept) + "\nResearch observations: " + d.Package.Research.Summary
	body, _ := json.Marshal(map[string]any{"model": g.config.Model, "prompt": prompt, "n": 1, "size": g.config.Size, "output_format": "jpeg", "quality": "high"})
	endpoint := strings.TrimRight(g.config.BaseURL, "/")
	if !strings.HasSuffix(endpoint, "/images/generations") {
		if !strings.HasSuffix(endpoint, "/v1") {
			endpoint += "/v1"
		}
		endpoint += "/images/generations"
	}
	ctx, cancel := context.WithTimeout(ctx, 160*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("invalid image route")
	}
	req.Header.Set("Authorization", "Bearer "+g.config.APIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := g.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("image route unavailable or timed out")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("image route returned HTTP %d; the researched text package is preserved", resp.StatusCode)
	}
	var result struct {
		Data []struct {
			Base64 string `json:"b64_json"`
		} `json:"data"`
	}
	if err = json.NewDecoder(io.LimitReader(resp.Body, 24<<20)).Decode(&result); err != nil || len(result.Data) != 1 {
		return nil, fmt.Errorf("invalid image response; expected one base64 image")
	}
	data, err := base64.StdEncoding.DecodeString(result.Data[0].Base64)
	if err != nil || len(data) > 16<<20 {
		return nil, fmt.Errorf("image route returned invalid or oversized image data")
	}
	return normalizeLiveThumbnail(data)
}

func normalizeLiveThumbnail(data []byte) ([]byte, error) {
	config, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width < 320 || config.Height < 180 || config.Width*config.Height > 20_000_000 {
		return nil, fmt.Errorf("generated image dimensions are invalid")
	}
	source, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("generated image could not be decoded")
	}
	bounds := source.Bounds()
	crop := bounds
	if bounds.Dx()*9 > bounds.Dy()*16 {
		width := bounds.Dy() * 16 / 9
		crop.Min.X += (bounds.Dx() - width) / 2
		crop.Max.X = crop.Min.X + width
	} else {
		height := bounds.Dx() * 9 / 16
		crop.Min.Y += (bounds.Dy() - height) / 2
		crop.Max.Y = crop.Min.Y + height
	}
	thumbnail := scaleLiveThumbnail(source, crop)
	var output bytes.Buffer
	if err = jpeg.Encode(&output, thumbnail, &jpeg.Options{Quality: 90}); err != nil {
		return nil, err
	}
	return output.Bytes(), nil
}

func scaleLiveThumbnail(source image.Image, crop image.Rectangle) *image.RGBA {
	output := image.NewRGBA(image.Rect(0, 0, 1280, 720))
	for y := 0; y < 720; y++ {
		for x := 0; x < 1280; x++ {
			sx := float64(crop.Min.X) + (float64(x)+.5)*float64(crop.Dx())/1280 - .5
			sy := float64(crop.Min.Y) + (float64(y)+.5)*float64(crop.Dy())/720 - .5
			sx = math.Max(float64(crop.Min.X), math.Min(float64(crop.Max.X-1), sx))
			sy = math.Max(float64(crop.Min.Y), math.Min(float64(crop.Max.Y-1), sy))
			x0, y0 := int(sx), int(sy)
			x1, y1 := min(x0+1, crop.Max.X-1), min(y0+1, crop.Max.Y-1)
			rx, ry := sx-float64(x0), sy-float64(y0)
			var channels [3]float64
			for i, point := range [4]image.Point{{x0, y0}, {x1, y0}, {x0, y1}, {x1, y1}} {
				r, g, b, _ := source.At(point.X, point.Y).RGBA()
				weight := [4]float64{(1 - rx) * (1 - ry), rx * (1 - ry), (1 - rx) * ry, rx * ry}[i]
				for c, value := range [3]uint32{r, g, b} {
					channels[c] += float64(value) * weight / 257
				}
			}
			offset := output.PixOffset(x, y)
			for c := 0; c < 3; c++ {
				output.Pix[offset+c] = uint8(channels[c] + .5)
			}
			output.Pix[offset+3] = 255
		}
	}
	return output
}
