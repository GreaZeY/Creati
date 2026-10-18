package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/color"
	"image/jpeg"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"creati.in/creati/backend/internal/types"
)

func TestLiveImageProducesActualThumbnail(t *testing.T) {
	source := image.NewRGBA(image.Rect(0, 0, 640, 480))
	for y := 0; y < 480; y++ {
		for x := 0; x < 640; x++ {
			source.Set(x, y, color.RGBA{R: 30, G: 100, B: 170, A: 255})
		}
	}
	var encoded bytes.Buffer
	if err := jpeg.Encode(&encoded, source, nil); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/images/generations" || r.Header.Get("Authorization") != "Bearer image-key" {
			t.Error("incorrect image route")
		}
		var request map[string]any
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatal(err)
		}
		if !strings.Contains(request["prompt"].(string), "Chat chooses the challenge") || request["output_format"] != "jpeg" {
			t.Error("image ignored actual viewer promise")
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"data": []any{map[string]string{"b64_json": base64.StdEncoding.EncodeToString(encoded.Bytes())}}})
	}))
	defer server.Close()
	g := NewLiveImageGenerator(LiveImageConfig{BaseURL: server.URL, Model: "image-model", APIKey: "image-key"}, server.Client())
	pack := liveFixturePackage()
	out, err := g.Generate(context.Background(), &types.LiveDraft{Idea: "A real ranked attempt", Package: &pack})
	if err != nil {
		t.Fatal(err)
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(out))
	if err != nil || format != "jpeg" || config.Width != 1280 || config.Height != 720 {
		t.Fatalf("invalid generated thumbnail: %+v %q %v", config, format, err)
	}
	if len(out) > 2<<20 {
		t.Fatal("thumbnail exceeds product upload limit")
	}
}
func TestLiveProducerRejectsMalformedPackage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"stop_reason":"end_turn","content":[{"type":"text","text":"not a package"}]}`))
	}))
	defer server.Close()
	p := NewLiveProducer(LiveProducerConfig{BaseURL: server.URL, Model: "model", APIKey: "key"}, server.Client())
	if _, _, err := p.Generate(context.Background(), "A stream", "", false); err == nil {
		t.Fatal("accepted malformed package")
	}
}
