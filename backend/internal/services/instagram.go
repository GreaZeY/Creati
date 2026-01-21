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

	"example.com/creati/backend/internal/db/models"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/facebook"
)

/**
 * InstagramService implements the Platform interface
 * Uses Meta's Instagram Graph API for authentication and content publishing
 * Instagram Business/Creator accounts are required for API access
 */
type InstagramService struct {
	db          *sql.DB
	oauthConfig *oauth2.Config
}

// NewInstagramService creates a new Instagram service instance
func NewInstagramService(db *sql.DB) *InstagramService {
	return &InstagramService{
		db: db,
		oauthConfig: &oauth2.Config{
			ClientID:     os.Getenv("INSTAGRAM_CLIENT_ID"),
			ClientSecret: os.Getenv("INSTAGRAM_CLIENT_SECRET"),
			RedirectURL:  os.Getenv("INSTAGRAM_REDIRECT_URL"),
			Scopes: []string{
				"instagram_basic",
				"instagram_content_publish",
				"pages_show_list",
				"pages_read_engagement",
			},
			Endpoint: facebook.Endpoint,
		},
	}
}

// GetAuthURL returns the OAuth URL for user authorization
func (i *InstagramService) GetAuthURL(state string) string {
	return i.oauthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
}

// Authenticate implements Platform interface
// Exchanges OAuth code for tokens and stores them
func (i *InstagramService) Authenticate(code string, userID int) error {
	// Exchange code for token using Facebook OAuth
	token, err := i.oauthConfig.Exchange(context.Background(), code)
	if err != nil {
		return fmt.Errorf("oauth exchange failed: %w", err)
	}

	// Get long-lived token (Facebook tokens are short-lived by default)
	longLivedToken, err := i.exchangeForLongLivedToken(token.AccessToken)
	if err != nil {
		// Continue with short-lived token if exchange fails
		longLivedToken = token.AccessToken
	}

	// Get Instagram Business Account ID and username
	igAccountID, username, err := i.getInstagramBusinessAccount(longLivedToken)
	if err != nil {
		return fmt.Errorf("failed to get instagram account: %w", err)
	}

	// Store tokens in database
	query := `
		INSERT INTO platform_accounts (user_id, platform, access_token, platform_user_id, status, profile_name)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (user_id, platform, platform_user_id) 
		DO UPDATE SET access_token = $3, status = $5, profile_name = $6, connected_at = NOW()
	`
	_, err = i.db.Exec(query, userID, "instagram", longLivedToken, igAccountID, "connected", username)
	return err
}

// exchangeForLongLivedToken exchanges a short-lived token for a long-lived one (60 days)
func (i *InstagramService) exchangeForLongLivedToken(shortLivedToken string) (string, error) {
	reqURL := fmt.Sprintf(
		"https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=%s&client_secret=%s&fb_exchange_token=%s",
		i.oauthConfig.ClientID,
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
		TokenType   string `json:"token_type"`
		ExpiresIn   int    `json:"expires_in"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	return result.AccessToken, nil
}

// getInstagramBusinessAccount retrieves the Instagram Business Account ID linked to the user's Facebook Page
func (i *InstagramService) getInstagramBusinessAccount(accessToken string) (string, string, error) {
	// First, get the user's Facebook Pages
	pagesURL := fmt.Sprintf("https://graph.facebook.com/v18.0/me/accounts?access_token=%s", accessToken)
	resp, err := http.Get(pagesURL)
	if err != nil {
		return "", "", err
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
		return "", "", err
	}

	if len(pagesResult.Data) == 0 {
		return "", "", fmt.Errorf("no Facebook Pages found. Instagram Business Account requires a linked Facebook Page")
	}

	// Get the Instagram Business Account linked to the first page
	pageID := pagesResult.Data[0].ID
	pageToken := pagesResult.Data[0].AccessToken

	igURL := fmt.Sprintf("https://graph.facebook.com/v18.0/%s?fields=instagram_business_account&access_token=%s", pageID, pageToken)
	resp, err = http.Get(igURL)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	var igResult struct {
		InstagramBusinessAccount struct {
			ID string `json:"id"`
		} `json:"instagram_business_account"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&igResult); err != nil {
		return "", "", err
	}

	if igResult.InstagramBusinessAccount.ID == "" {
		return "", "", fmt.Errorf("no Instagram Business Account linked to Facebook Page")
	}

	// Get Instagram username
	usernameURL := fmt.Sprintf("https://graph.facebook.com/v18.0/%s?fields=username&access_token=%s",
		igResult.InstagramBusinessAccount.ID, pageToken)
	resp, err = http.Get(usernameURL)
	if err != nil {
		return igResult.InstagramBusinessAccount.ID, "", err
	}
	defer resp.Body.Close()

	var usernameResult struct {
		Username string `json:"username"`
	}
	json.NewDecoder(resp.Body).Decode(&usernameResult)

	return igResult.InstagramBusinessAccount.ID, usernameResult.Username, nil
}

// Upload implements Platform interface
// Uploads a Reel to Instagram
func (i *InstagramService) Upload(video *models.Video) (string, error) {
	// Get user's access token and Instagram account ID
	var accessToken, igAccountID string
	err := i.db.QueryRow(
		"SELECT access_token, platform_user_id FROM platform_accounts WHERE user_id = $1 AND platform = $2",
		video.UserID, "instagram",
	).Scan(&accessToken, &igAccountID)
	if err != nil {
		return "", fmt.Errorf("no instagram account connected: %w", err)
	}

	// Step 1: Create media container for Reel
	containerURL := fmt.Sprintf("https://graph.facebook.com/v18.0/%s/media", igAccountID)
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

	body, _ := io.ReadAll(resp.Body)
	var containerResult struct {
		ID    string `json:"id"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.Unmarshal(body, &containerResult); err != nil {
		return "", fmt.Errorf("failed to parse container response: %w", err)
	}

	if containerResult.Error.Message != "" {
		return "", fmt.Errorf("instagram API error: %s", containerResult.Error.Message)
	}

	// Step 2: Publish the container
	publishURL := fmt.Sprintf("https://graph.facebook.com/v18.0/%s/media_publish", igAccountID)
	publishData := url.Values{}
	publishData.Set("creation_id", containerResult.ID)
	publishData.Set("access_token", accessToken)

	resp, err = http.PostForm(publishURL, publishData)
	if err != nil {
		return "", fmt.Errorf("failed to publish media: %w", err)
	}
	defer resp.Body.Close()

	var publishResult struct {
		ID    string `json:"id"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&publishResult); err != nil {
		return "", fmt.Errorf("failed to parse publish response: %w", err)
	}

	if publishResult.Error.Message != "" {
		return "", fmt.Errorf("instagram publish error: %s", publishResult.Error.Message)
	}

	return publishResult.ID, nil
}

// GetStatus implements Platform interface
func (i *InstagramService) GetStatus(platformVideoID string) (string, error) {
	// Instagram doesn't have a processing status like YouTube
	// Media is either published or not
	return "completed", nil
}

// FetchAnalytics implements Platform interface
func (i *InstagramService) FetchAnalytics(platformVideoID string) (*Analytics, error) {
	var accessToken string
	err := i.db.QueryRow(
		"SELECT access_token FROM platform_accounts WHERE platform = 'instagram' LIMIT 1",
	).Scan(&accessToken)
	if err != nil {
		return nil, fmt.Errorf("no instagram account found: %w", err)
	}

	// Get media insights
	insightsURL := fmt.Sprintf(
		"https://graph.facebook.com/v18.0/%s/insights?metric=plays,likes,comments,shares&access_token=%s",
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
