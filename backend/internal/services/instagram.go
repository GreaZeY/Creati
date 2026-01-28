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

	"example.com/creati/backend/internal/utils"
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
	config.RedirectURL = fmt.Sprintf("%s/platforms/instagram/callback", os.Getenv("FRONTEND_URL"))

	opts := []oauth2.AuthCodeOption{oauth2.AccessTypeOffline}
	// Note: Direct Instagram OAuth might use 'enable_fb_login=0' to force Instagram login window
	// but usually the endpoint itself handles it.
	return config.AuthCodeURL(state, opts...)
}

// Authenticate implements Platform interface
// Exchanges OAuth code for tokens and stores them
func (i *InstagramService) Authenticate(code string, userID int) error {
	config := *i.oauthConfig
	config.RedirectURL = fmt.Sprintf("%s/platforms/instagram/callback", os.Getenv("FRONTEND_URL"))

	// Exchange code for token using Facebook OAuth
	token, err := config.Exchange(context.Background(), code)
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
	igAccountID, username, profileName, err := i.getInstagramBusinessAccount(longLivedToken)
	if err != nil {
		return fmt.Errorf("failed to get instagram account: %w", err)
	}

	// Encrypt tokens before storing
	encAccess, err := utils.Encrypt(longLivedToken)
	if err != nil {
		return fmt.Errorf("failed to encrypt access token: %w", err)
	}

	// Store tokens in database
	query := `
		INSERT INTO platform_accounts (user_id, platform, access_token, platform_user_id, status, profile_name, handle)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (user_id, platform, platform_user_id) 
		DO UPDATE SET access_token = $3, status = $5, profile_name = $6, handle = $7, connected_at = NOW()
	`
	_, err = i.db.Exec(query, userID, "instagram", encAccess, igAccountID, "connected", profileName, username)
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
func (i *InstagramService) getInstagramBusinessAccount(accessToken string) (string, string, string, error) {
	// First, get the user's Facebook Pages
	pagesURL := fmt.Sprintf("https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token&access_token=%s", accessToken)
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
		return "", "", "", fmt.Errorf("INSTAGRAM_NO_PAGES: No Facebook Pages found. You need a Facebook Page linked to your professional Instagram account to connect correctly.")
	}

	// For each page, check for linked IG account
	for _, page := range pagesResult.Data {
		pageID := page.ID
		pageToken := page.AccessToken
		pageName := page.Name

		igURL := fmt.Sprintf("https://graph.facebook.com/v18.0/%s?fields=instagram_business_account&access_token=%s", pageID, pageToken)
		resp, err = http.Get(igURL)
		if err != nil {
			continue
		}
		defer resp.Body.Close()

		var igResult struct {
			InstagramBusinessAccount struct {
				ID string `json:"id"`
			} `json:"instagram_business_account"`
		}

		if err := json.NewDecoder(resp.Body).Decode(&igResult); err != nil {
			continue
		}

		igAccountID := igResult.InstagramBusinessAccount.ID
		if igAccountID != "" {
			// Fetch username and name
			usernameURL := fmt.Sprintf("https://graph.facebook.com/v18.0/%s?fields=username,name&access_token=%s",
				igAccountID, pageToken)
			userResp, err := http.Get(usernameURL)
			if err == nil {
				defer userResp.Body.Close()
				var user struct {
					Username string `json:"username"`
					Name     string `json:"name"`
				}
				if err := json.NewDecoder(userResp.Body).Decode(&user); err == nil {
					displayName := user.Name
					if displayName == "" {
						displayName = pageName
					}
					return igAccountID, user.Username, displayName, nil
				}
			}
			return igAccountID, "unknown", pageName, nil
		}
	}

	return "", "", "", fmt.Errorf("INSTAGRAM_NOT_PROFESSIONAL: No linked Instagram Business or Creator account found. Please switch your Instagram account to Professional and link it to a Facebook Page.")
}

// Upload implements Platform interface
// Uploads a Reel to Instagram
func (i *InstagramService) Upload(video *models.Video, accountID int) (string, error) {
	// Get specific account's tokens and Instagram account ID
	var encAccess, igAccountID string
	err := i.db.QueryRow(
		"SELECT access_token, platform_user_id FROM platform_accounts WHERE id = $1", accountID,
	).Scan(&encAccess, &igAccountID)
	if err != nil {
		return "", fmt.Errorf("account not found: %w", err)
	}

	// Decrypt token
	accessToken, err := utils.Decrypt(encAccess)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt access token: %w", err)
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
func (i *InstagramService) FetchAnalytics(platformVideoID string, accountID int) (*Analytics, error) {
	var encAccess string
	err := i.db.QueryRow(
		"SELECT access_token FROM platform_accounts WHERE id = $1", accountID,
	).Scan(&encAccess)
	if err != nil {
		return nil, fmt.Errorf("account not found: %w", err)
	}

	// Decrypt token
	accessToken, err := utils.Decrypt(encAccess)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt access token: %w", err)
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
