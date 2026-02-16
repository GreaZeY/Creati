package api

import (
	"database/sql"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"creati.in/creati/backend/internal/services"
	"creati.in/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
)

type ProxyHandler struct {
	client *http.Client
	db     *sql.DB
	media  *services.MediaService
}

func NewProxyHandler(db *sql.DB, media *services.MediaService) *ProxyHandler {
	return &ProxyHandler{
		db:    db,
		media: media,
		client: &http.Client{
			Timeout: 30 * time.Minute, // Allow long downloads/streams
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) >= 10 {
					return fmt.Errorf("stopped after 10 redirects")
				}
				return nil
			},
		},
	}
}

func (h *ProxyHandler) HandleProxyVideo(c *fiber.Ctx) error {
	targetURL := c.Query("url")
	if targetURL == "" {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "URL parameter is required")
	}

	// 1. Try Platform API Resolution first (Smart Mode)
	// Check for Facebook
	if strings.Contains(targetURL, "facebook.com") || strings.Contains(targetURL, "fb.watch") {
		// Extract Video ID
		// Formats: facebook.com/watch/?v=123, facebook.com/page/videos/123, fb.watch/xyz
		// Simple regex for ID
		// We'll trust the query param 'v' if present, or regex
		var videoID string
		u, _ := url.Parse(targetURL)
		if u != nil {
			videoID = u.Query().Get("v")
		}

		if videoID == "" {
			// Try path regex
			re := regexp.MustCompile(`videos/(\d+)`)
			matches := re.FindStringSubmatch(targetURL)
			if len(matches) > 1 {
				videoID = matches[1]
			}
		}

		if videoID != "" {
			// Use MediaService to Ensure Cached!
			// This downloads once and reuses.
			storageKey, err := h.media.EnsureCached(c.Context(), "facebook", videoID)
			if err == nil {
				// Stream from Storage
				stream, err := h.media.GetStream(c.Context(), storageKey)
				if err == nil {
					// We just pass the stream. Fiber will read it.
					// c.SendStream will read from reader.

					// Set headers? Content-Type?
					// EnsureCached saves as mp4 usually.
					c.Set("Content-Type", "video/mp4")
					c.Set("Access-Control-Allow-Origin", "*")
					return c.SendStream(stream)
				}
			}
			// If MediaService fails (download error), we fall back?
			// User said "return streamable url".
			// If download fails, we fallback to direct proxy (Option 2).
		}
	}

	// 2. Direct Proxy (Fallback for direct MP4 links or other platforms)
	req, err := http.NewRequest("GET", targetURL, nil)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to create request", err)
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	resp, err := h.client.Do(req)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadGateway, "Failed to fetch video", err)
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return utils.ErrorResponse(c, resp.StatusCode, fmt.Sprintf("Upstream returned %d", resp.StatusCode))
	}

	// Check Content-Type to avoid proxying HTML pages if platform resolution failed
	contentType := resp.Header.Get("Content-Type")
	if strings.Contains(contentType, "text/html") {
		resp.Body.Close()
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "URL returned HTML. Please use a direct video link or a supported platform URL.")
	}

	c.Set("Content-Type", contentType)
	if cl := resp.Header.Get("Content-Length"); cl != "" {
		c.Set("Content-Length", cl)
	}
	c.Set("Content-Disposition", resp.Header.Get("Content-Disposition"))
	c.Set("Access-Control-Allow-Origin", "*")

	return c.SendStream(resp.Body)
}
