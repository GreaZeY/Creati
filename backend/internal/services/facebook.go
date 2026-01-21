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

	"example.com/creati/backend/internal/db/models"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/facebook"
)

/**
 * FacebookService implements the Platform interface
 * Uses Meta's Graph API for authentication and video publishing to Facebook Pages
 */
type FacebookService struct {
	db          *sql.DB
	oauthConfig *oauth2.Config
}

// NewFacebookService creates a new Facebook service instance
func NewFacebookService(db *sql.DB) *FacebookService {
	return &FacebookService{
		db: db,
		oauthConfig: &oauth2.Config{
			ClientID:     os.Getenv("FACEBOOK_CLIENT_ID"),
			ClientSecret: os.Getenv("FACEBOOK_CLIENT_SECRET"),
			RedirectURL:  os.Getenv("FACEBOOK_REDIRECT_URL"),
			Scopes: []string{
				"pages_show_list",
				"pages_read_engagement",
				"pages_manage_posts",
				"publish_video",
			},
			Endpoint: facebook.Endpoint,
		},
	}
}

// GetAuthURL returns the OAuth URL for user authorization
func (f *FacebookService) GetAuthURL(state string) string {
	return f.oauthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
}

// Authenticate implements Platform interface
func (f *FacebookService) Authenticate(code string, userID int) error {
	// Exchange code for token
	token, err := f.oauthConfig.Exchange(context.Background(), code)
	if err != nil {
		return fmt.Errorf("oauth exchange failed: %w", err)
	}

	// Get long-lived token
	longLivedToken, err := f.exchangeForLongLivedToken(token.AccessToken)
	if err != nil {
		longLivedToken = token.AccessToken
	}

	// Get user's Facebook Page info
	pageID, pageName, pageToken, err := f.getPageInfo(longLivedToken)
	if err != nil {
		return fmt.Errorf("failed to get page info: %w", err)
	}

	// Store tokens in database - store page token for posting
	query := `
		INSERT INTO platform_accounts (user_id, platform, access_token, refresh_token, platform_user_id, status, profile_name)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (user_id, platform, platform_user_id) 
		DO UPDATE SET access_token = $3, refresh_token = $4, status = $6, profile_name = $7, connected_at = NOW()
	`
	_, err = f.db.Exec(query, userID, "facebook", pageToken, longLivedToken, pageID, "connected", pageName)
	return err
}

// exchangeForLongLivedToken exchanges a short-lived token for a long-lived one
func (f *FacebookService) exchangeForLongLivedToken(shortLivedToken string) (string, error) {
	reqURL := fmt.Sprintf(
		"https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=%s&client_secret=%s&fb_exchange_token=%s",
		f.oauthConfig.ClientID,
		f.oauthConfig.ClientSecret,
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

// getPageInfo retrieves the user's Facebook Page
func (f *FacebookService) getPageInfo(accessToken string) (string, string, string, error) {
	pagesURL := fmt.Sprintf("https://graph.facebook.com/v18.0/me/accounts?access_token=%s", accessToken)
	resp, err := http.Get(pagesURL)
	if err != nil {
		return "", "", "", err
	}
	defer resp.Body.Close()

	var pagesResult struct {
		Data []struct {
			ID          string `json:"id"`
			Name        string `json:"name"`
			AccessToken string `json:"access_token"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&pagesResult); err != nil {
		return "", "", "", err
	}

	if len(pagesResult.Data) == 0 {
		return "", "", "", fmt.Errorf("no Facebook Pages found. Please create a Facebook Page first")
	}

	// Return first page info
	page := pagesResult.Data[0]
	return page.ID, page.Name, page.AccessToken, nil
}

// Upload implements Platform interface - uploads video to Facebook Page
func (f *FacebookService) Upload(video *models.Video) (string, error) {
	var pageToken, pageID string
	err := f.db.QueryRow(
		"SELECT access_token, platform_user_id FROM platform_accounts WHERE user_id = $1 AND platform = $2",
		video.UserID, "facebook",
	).Scan(&pageToken, &pageID)
	if err != nil {
		return "", fmt.Errorf("no facebook account connected: %w", err)
	}

	// Upload video using resumable upload API
	// Step 1: Initialize upload session
	initURL := fmt.Sprintf("https://graph.facebook.com/v18.0/%s/videos", pageID)
	data := url.Values{}
	data.Set("upload_phase", "start")
	data.Set("file_url", video.S3URL)
	data.Set("access_token", pageToken)

	resp, err := http.PostForm(initURL, data)
	if err != nil {
		return "", fmt.Errorf("failed to initialize upload: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var initResult struct {
		VideoID string `json:"video_id"`
		Error   struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.Unmarshal(body, &initResult); err != nil {
		return "", fmt.Errorf("failed to parse init response: %w", err)
	}

	if initResult.Error.Message != "" {
		return "", fmt.Errorf("facebook API error: %s", initResult.Error.Message)
	}

	// Step 2: Finish upload with metadata
	finishURL := fmt.Sprintf("https://graph.facebook.com/v18.0/%s/videos", pageID)
	finishData := url.Values{}
	finishData.Set("upload_phase", "finish")
	finishData.Set("video_id", initResult.VideoID)
	finishData.Set("title", video.Title)
	finishData.Set("description", video.Description)
	finishData.Set("access_token", pageToken)

	resp, err = http.PostForm(finishURL, finishData)
	if err != nil {
		return "", fmt.Errorf("failed to finish upload: %w", err)
	}
	defer resp.Body.Close()

	var finishResult struct {
		Success bool `json:"success"`
		Error   struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&finishResult); err != nil {
		return "", fmt.Errorf("failed to parse finish response: %w", err)
	}

	if finishResult.Error.Message != "" {
		return "", fmt.Errorf("facebook finish error: %s", finishResult.Error.Message)
	}

	return initResult.VideoID, nil
}

// GetStatus implements Platform interface
func (f *FacebookService) GetStatus(platformVideoID string) (string, error) {
	var pageToken string
	err := f.db.QueryRow(
		"SELECT access_token FROM platform_accounts WHERE platform = 'facebook' LIMIT 1",
	).Scan(&pageToken)
	if err != nil {
		return "", fmt.Errorf("no facebook account found: %w", err)
	}

	statusURL := fmt.Sprintf(
		"https://graph.facebook.com/v18.0/%s?fields=status&access_token=%s",
		platformVideoID, pageToken,
	)

	resp, err := http.Get(statusURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		Status struct {
			VideoStatus string `json:"video_status"`
		} `json:"status"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	return result.Status.VideoStatus, nil
}

// FetchAnalytics implements Platform interface
func (f *FacebookService) FetchAnalytics(platformVideoID string) (*Analytics, error) {
	var pageToken string
	err := f.db.QueryRow(
		"SELECT access_token FROM platform_accounts WHERE platform = 'facebook' LIMIT 1",
	).Scan(&pageToken)
	if err != nil {
		return nil, fmt.Errorf("no facebook account found: %w", err)
	}

	insightsURL := fmt.Sprintf(
		"https://graph.facebook.com/v18.0/%s/video_insights?metric=total_video_views,total_video_reactions_by_type_total,total_video_comments&access_token=%s",
		platformVideoID, pageToken,
	)

	resp, err := http.Get(insightsURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var insightsResult struct {
		Data []struct {
			Name   string `json:"name"`
			Values []struct {
				Value interface{} `json:"value"`
			} `json:"values"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&insightsResult); err != nil {
		return nil, err
	}

	analytics := &Analytics{}
	for _, metric := range insightsResult.Data {
		if len(metric.Values) > 0 {
			switch metric.Name {
			case "total_video_views":
				if v, ok := metric.Values[0].Value.(float64); ok {
					analytics.Views = int64(v)
				}
			case "total_video_comments":
				if v, ok := metric.Values[0].Value.(float64); ok {
					analytics.Comments = int64(v)
				}
			case "total_video_reactions_by_type_total":
				// Sum all reaction types for likes
				if reactions, ok := metric.Values[0].Value.(map[string]interface{}); ok {
					for _, count := range reactions {
						if v, ok := count.(float64); ok {
							analytics.Likes += int64(v)
						}
					}
				}
			}
		}
	}

	return analytics, nil
}
