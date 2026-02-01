package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"creati.in/creati/backend/internal/db/models"
	"golang.org/x/oauth2"

	"creati.in/creati/backend/internal/db/repositories"
	"creati.in/creati/backend/internal/utils"
)

/**
 * InstagramService implements the Platform interface
 * Uses Meta's Instagram Login for Business (native Instagram domains)
 */
type InstagramService struct {
	db          *sql.DB
	oauthConfig *oauth2.Config
	repo        *repositories.PlatformRepository
}

// NewInstagramService creates a new Instagram service instance
func NewInstagramService(db *sql.DB) *InstagramService {
	return &InstagramService{
		db:   db,
		repo: repositories.NewPlatformRepository(db),
		oauthConfig: &oauth2.Config{
			ClientID:     os.Getenv("INSTAGRAM_CLIENT_ID"),
			ClientSecret: os.Getenv("INSTAGRAM_CLIENT_SECRET"),
			Scopes: []string{
				"instagram_business_basic",
				"instagram_business_content_publish",
				"instagram_business_manage_comments",
				"instagram_business_manage_insights",
			},
			Endpoint: oauth2.Endpoint{
				AuthURL:  "https://www.instagram.com/oauth/authorize",
				TokenURL: "https://api.instagram.com/oauth/access_token",
			},
		},
	}
}

// GetAuthURL returns the OAuth URL for user authorization
func (i *InstagramService) GetAuthURL(state string) string {
	return i.GetAuthURLWithHint(state, "", "")
}

// GetAuthURLWithHint returns OAuth URL with optional hint/prompt
func (i *InstagramService) GetAuthURLWithHint(state, prompt, loginHint string) string {
	config := *i.oauthConfig
	frontendURL := strings.TrimSuffix(os.Getenv("FRONTEND_URL"), "/")
	config.RedirectURL = fmt.Sprintf("%s/platforms/instagram/callback", frontendURL)

	opts := []oauth2.AuthCodeOption{oauth2.AccessTypeOffline}
	return config.AuthCodeURL(state, opts...)
}

// Authenticate implements Platform interface
func (i *InstagramService) Authenticate(code string, userID int, clientID *int) error {
	config := *i.oauthConfig
	frontendURL := strings.TrimSuffix(os.Getenv("FRONTEND_URL"), "/")
	config.RedirectURL = fmt.Sprintf("%s/platforms/instagram/callback", frontendURL)

	// Exchange code for token using api.instagram.com
	token, err := config.Exchange(context.Background(), code)
	if err != nil {
		return fmt.Errorf("oauth exchange failed: %w", err)
	}

	// Exchange for long-lived token using graph.instagram.com
	longLivedToken, err := i.exchangeForLongLivedToken(token.AccessToken)
	if err != nil {
		longLivedToken = token.AccessToken
	}

	// Discover Instagram Account using graph.instagram.com
	igUserID, username, profileName, err := i.discoverInstagramAccount(longLivedToken)
	status := "connected"

	if err != nil {
		// Fallback to identity info if discovery fails
		fbID, fbName, fbErr := i.getIdentityProfile(longLivedToken)
		if fbErr != nil {
			return fmt.Errorf("failed discovery and identity fallback: %w (discovery error: %v)", fbErr, err)
		}
		igUserID = fbID
		username = "ig_" + fbID
		profileName = fbName + " (Action Required)"
		status = "action_required"
	}

	// Encrypt tokens before storing
	encAccess, err := utils.Encrypt(longLivedToken)
	if err != nil {
		return fmt.Errorf("failed to encrypt tokens: %w", err)
	}

	// Use Repository to persist account
	account := &models.PlatformAccount{
		UserID:         userID,
		ClientID:       clientID,
		Platform:       "instagram",
		AccessToken:    encAccess,
		PlatformUserID: igUserID,
		Status:         status,
		ProfileName:    profileName,
		Handle:         username,
	}

	return i.repo.UpsertAccount(context.Background(), account)
}

// discoverInstagramAccount retrieves the IG User identity directly from graph.instagram.com
func (i *InstagramService) discoverInstagramAccount(accessToken string) (string, string, string, error) {
	reqURL := fmt.Sprintf("https://graph.instagram.com/v19.0/me?fields=id,username,name&access_token=%s", accessToken)
	resp, err := http.Get(reqURL)
	if err != nil {
		return "", "", "", err
	}
	defer resp.Body.Close()

	var result struct {
		ID       string `json:"id"`
		Username string `json:"username"`
		Name     string `json:"name"`
		Error    struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", "", "", err
	}

	if result.Error.Message != "" {
		return "", "", "", fmt.Errorf("discovery error: %s", result.Error.Message)
	}

	return result.ID, result.Username, result.Name, nil
}

// getIdentityProfile retrieves the basic identity as a fallback
func (i *InstagramService) getIdentityProfile(accessToken string) (string, string, error) {
	reqURL := fmt.Sprintf("https://graph.instagram.com/v19.0/me?fields=id,name&access_token=%s", accessToken)
	resp, err := http.Get(reqURL)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	var result struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", "", err
	}

	return result.ID, result.Name, nil
}

// exchangeForLongLivedToken exchanges a short-lived token for a long-lived one (60 days)
func (i *InstagramService) exchangeForLongLivedToken(shortLivedToken string) (string, error) {
	reqURL := fmt.Sprintf(
		"https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=%s&access_token=%s",
		i.oauthConfig.ClientSecret,
		shortLivedToken,
	)

	resp, err := http.Get(reqURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		AccessToken string `json:"access_token"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	return result.AccessToken, nil
}

// Upload implements Platform interface - publishes a Reel
func (i *InstagramService) Upload(video *models.Video, accountID int) (string, error) {
	var encAccess, igUserID string
	err := i.db.QueryRow(
		"SELECT access_token, platform_user_id FROM platform_accounts WHERE id = $1", accountID,
	).Scan(&encAccess, &igUserID)
	if err != nil {
		return "", fmt.Errorf("account not found: %w", err)
	}

	accessToken, err := utils.Decrypt(encAccess)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt tokens: %w", err)
	}

	// Step 1: Create media container using graph.instagram.com
	containerURL := fmt.Sprintf("https://graph.instagram.com/v19.0/%s/media", igUserID)
	data := url.Values{}
	data.Set("media_type", "REELS")
	data.Set("video_url", video.S3URL)
	data.Set("caption", fmt.Sprintf("%s\n\n%s", video.Title, video.Description))
	data.Set("access_token", accessToken)

	resp, err := http.PostForm(containerURL, data)
	if err != nil {
		return "", fmt.Errorf("failed to create media container: %w", err)
	}
	defer resp.Body.Close()

	var containerResult struct {
		ID    string `json:"id"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&containerResult); err != nil {
		return "", fmt.Errorf("failed to parse container response: %w", err)
	}

	if containerResult.Error.Message != "" {
		return "", fmt.Errorf("instagram API error: %s", containerResult.Error.Message)
	}

	containerID := containerResult.ID

	// Step 2: Poll for processing status
	maxRetries := 30
	statusURL := fmt.Sprintf("https://graph.instagram.com/v19.0/%s?fields=status_code&access_token=%s", containerID, accessToken)

	for attempt := 0; attempt < maxRetries; attempt++ {
		time.Sleep(10 * time.Second)

		statusResp, err := http.Get(statusURL)
		if err != nil {
			continue
		}

		var statusResult struct {
			StatusCode string `json:"status_code"`
			Error      struct {
				Message string `json:"message"`
			} `json:"error"`
		}

		err = json.NewDecoder(statusResp.Body).Decode(&statusResult)
		statusResp.Body.Close()
		if err != nil {
			continue
		}

		if statusResult.StatusCode == "FINISHED" {
			break
		}

		if statusResult.StatusCode == "ERROR" || statusResult.StatusCode == "EXPIRED" {
			return "", fmt.Errorf("instagram processing failed: %s", statusResult.StatusCode)
		}

		if attempt == maxRetries-1 {
			return "", fmt.Errorf("instagram processing timed out")
		}
	}

	// Step 3: Publish the Reel
	publishURL := fmt.Sprintf("https://graph.instagram.com/v19.0/%s/media_publish", igUserID)
	publishData := url.Values{}
	publishData.Set("creation_id", containerID)
	publishData.Set("access_token", accessToken)

	publishResp, err := http.PostForm(publishURL, publishData)
	if err != nil {
		return "", fmt.Errorf("failed to publish Reel: %w", err)
	}
	defer publishResp.Body.Close()

	var publishResult struct {
		ID    string `json:"id"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.NewDecoder(publishResp.Body).Decode(&publishResult); err != nil {
		return "", fmt.Errorf("failed to parse publish response: %w", err)
	}

	if publishResult.Error.Message != "" {
		return "", fmt.Errorf("instagram publish error: %s", publishResult.Error.Message)
	}

	return publishResult.ID, nil
}

// GetStatus implements Platform interface
func (i *InstagramService) GetStatus(platformVideoID string) (string, error) {
	return "completed", nil
}

// FetchAnalytics implements Platform interface
func (i *InstagramService) FetchAnalytics(platformVideoID string, accountID int) (*Analytics, error) {
	var encAccess string
	err := i.db.QueryRow(
		"SELECT access_token FROM platform_accounts WHERE id = $1", accountID,
	).Scan(&encAccess)
	if err != nil {
		return nil, fmt.Errorf("account not found: %w", err)
	}

	accessToken, err := utils.Decrypt(encAccess)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt tokens: %w", err)
	}

	insightsURL := fmt.Sprintf(
		"https://graph.instagram.com/v19.0/%s/insights?metric=plays,likes,comments,shares&access_token=%s",
		platformVideoID, accessToken,
	)

	resp, err := http.Get(insightsURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch insights: %w", err)
	}
	defer resp.Body.Close()

	var insightsResult struct {
		Data []struct {
			Name   string `json:"name"`
			Values []struct {
				Value int64 `json:"value"`
			} `json:"values"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&insightsResult); err != nil {
		return nil, fmt.Errorf("failed to parse insights: %w", err)
	}

	analytics := &Analytics{}
	for _, metric := range insightsResult.Data {
		if len(metric.Values) > 0 {
			switch strings.ToLower(metric.Name) {
			case "plays":
				analytics.Views = metric.Values[0].Value
			case "likes":
				analytics.Likes = metric.Values[0].Value
			case "comments":
				analytics.Comments = metric.Values[0].Value
			case "shares":
				analytics.Shares = metric.Values[0].Value
			}
		}
	}

	return analytics, nil
}

// FetchRecentVideos retrieves past videos from Instagram
func (i *InstagramService) FetchRecentVideos(accountID int) ([]ExternalVideo, error) {
	var encAccess, igUserID string
	err := i.db.QueryRow(
		"SELECT access_token, platform_user_id FROM platform_accounts WHERE id = $1", accountID,
	).Scan(&encAccess, &igUserID)
	if err != nil {
		return nil, fmt.Errorf("account not found: %w", err)
	}

	accessToken, err := utils.Decrypt(encAccess)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt tokens: %w", err)
	}

	mediaURL := fmt.Sprintf(
		"https://graph.instagram.com/v19.0/%s/media?fields=id,media_type,media_url,thumbnail_url,caption,timestamp,permalink&access_token=%s",
		igUserID, accessToken,
	)

	resp, err := http.Get(mediaURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch media: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Data []struct {
			ID           string `json:"id"`
			MediaType    string `json:"media_type"`
			MediaURL     string `json:"media_url"`
			ThumbnailURL string `json:"thumbnail_url"`
			Caption      string `json:"caption"`
			Timestamp    string `json:"timestamp"`
			Permalink    string `json:"permalink"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	videos := make([]ExternalVideo, 0)
	for _, item := range result.Data {
		if item.MediaType != "VIDEO" {
			continue
		}

		publishedAt, _ := time.Parse(time.RFC3339, item.Timestamp)
		title := item.Caption
		if idx := strings.Index(title, "\n"); idx != -1 {
			title = title[:idx]
		}
		if len(title) > 50 {
			title = title[:50] + "..."
		}
		if title == "" {
			title = "Instagram Video"
		}

		videos = append(videos, ExternalVideo{
			ID:          item.ID,
			Title:       title,
			Description: item.Caption,
			Thumbnail:   item.ThumbnailURL,
			URL:         item.Permalink,
			PublishedAt: publishedAt,
		})
	}

	return videos, nil
}

// GetStream implements Platform interface
func (i *InstagramService) GetStream(ctx context.Context, platformVideoID string) (io.ReadCloser, string, error) {
	return nil, "", fmt.Errorf("GetStream not implemented for Instagram")
}
