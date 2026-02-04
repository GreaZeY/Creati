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
	"golang.org/x/oauth2/facebook"

	"creati.in/creati/backend/internal/db/repositories"
	"creati.in/creati/backend/internal/utils"
)

/**
 * FacebookService implements the Platform interface
 * Uses Meta's Graph API for authentication and video publishing to Facebook Pages
 */
type FacebookService struct {
	db          *sql.DB
	oauthConfig *oauth2.Config
	repo        *repositories.PlatformRepository
}

// NewFacebookService creates a new Facebook service instance
func NewFacebookService(db *sql.DB) *FacebookService {
	return &FacebookService{
		db:   db,
		repo: repositories.NewPlatformRepository(db),
		oauthConfig: &oauth2.Config{
			ClientID:     os.Getenv("FACEBOOK_CLIENT_ID"),
			ClientSecret: os.Getenv("FACEBOOK_CLIENT_SECRET"),
			Scopes: []string{
				"pages_show_list",
				"pages_read_engagement",
				"pages_manage_posts",
				// "publish_video",
			},
			Endpoint: facebook.Endpoint,
		},
	}
}

// GetAuthURL returns the OAuth URL for user authorization
func (f *FacebookService) GetAuthURL(state string) string {
	return f.GetAuthURLWithHint(state, "", "")
}

// GetAuthURLWithHint returns OAuth URL with optional hint/prompt
func (f *FacebookService) GetAuthURLWithHint(state, prompt, loginHint string) string {
	config := *f.oauthConfig
	frontendURL := strings.TrimSuffix(os.Getenv("FRONTEND_URL"), "/")
	config.RedirectURL = fmt.Sprintf("%s/platforms/facebook/callback", frontendURL)

	opts := []oauth2.AuthCodeOption{oauth2.AccessTypeOffline}
	if prompt == "reauthenticate" || prompt == "consent" {
		opts = append(opts, oauth2.SetAuthURLParam("auth_type", "reauthenticate"))
	}
	// Meta doesn't support login_hint but we accept it for interface compliance
	return config.AuthCodeURL(state, opts...)
}

// Authenticate implements Platform interface
func (f *FacebookService) Authenticate(code string, userID int, clientID *int) error {
	config := *f.oauthConfig
	frontendURL := strings.TrimSuffix(os.Getenv("FRONTEND_URL"), "/")
	config.RedirectURL = fmt.Sprintf("%s/platforms/facebook/callback", frontendURL)

	// Exchange code for token
	token, err := config.Exchange(context.Background(), code)
	if err != nil {
		return fmt.Errorf("oauth exchange failed: %w", err)
	}

	// Get long-lived token
	longLivedToken, err := f.exchangeForLongLivedToken(token.AccessToken)
	if err != nil {
		longLivedToken = token.AccessToken
	}

	// Get user's Facebook Page info
	pageID, pageName, pageToken, username, err := f.getPageInfo(longLivedToken)
	if err != nil {
		return fmt.Errorf("failed to get page info: %w", err)
	}

	// Encrypt tokens before storing
	encPageToken, err := utils.Encrypt(pageToken)
	if err != nil {
		return fmt.Errorf("failed to encrypt page token: %w", err)
	}
	encLongLived, err := utils.Encrypt(longLivedToken)
	if err != nil {
		return fmt.Errorf("failed to encrypt long-lived token: %w", err)
	}

	// Use Repository to persist account
	account := &models.PlatformAccount{
		UserID:         userID,
		ClientID:       clientID,
		Platform:       "facebook",
		AccessToken:    encPageToken,
		RefreshToken:   encLongLived,
		PlatformUserID: pageID,
		Status:         "connected",
		ProfileName:    pageName,
		Handle:         username,
	}

	return f.repo.UpsertAccount(context.Background(), account)
}

// exchangeForLongLivedToken exchanges a short-lived token for a long-lived one
func (f *FacebookService) exchangeForLongLivedToken(shortLivedToken string) (string, error) {
	reqURL := fmt.Sprintf(
		"https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=%s&client_secret=%s&fb_exchange_token=%s",
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
func (f *FacebookService) getPageInfo(accessToken string) (string, string, string, string, error) {
	pagesURL := fmt.Sprintf("https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,username&access_token=%s", accessToken)
	resp, err := http.Get(pagesURL)
	if err != nil {
		return "", "", "", "", err
	}
	defer resp.Body.Close()

	var pagesResult struct {
		Data []struct {
			ID          string `json:"id"`
			Name        string `json:"name"`
			AccessToken string `json:"access_token"`
			Username    string `json:"username"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&pagesResult); err != nil {
		return "", "", "", "", err
	}

	if len(pagesResult.Data) == 0 {
		return "", "", "", "", fmt.Errorf("no Facebook Pages found. Please create a Facebook Page first")
	}

	// Return first page info
	page := pagesResult.Data[0]
	return page.ID, page.Name, page.AccessToken, page.Username, nil
}

// Upload implements Platform interface - uploads video to Facebook Page
func (f *FacebookService) Upload(video *models.Video, accountID int) (string, error) {
	var encPageToken, pageID string
	err := f.db.QueryRow(
		"SELECT access_token, platform_user_id FROM platform_accounts WHERE id = $1", accountID,
	).Scan(&encPageToken, &pageID)
	if err != nil {
		return "", fmt.Errorf("account not found: %w", err)
	}

	// Decrypt token
	pageToken, err := utils.Decrypt(encPageToken)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt page token: %w", err)
	}

	// Upload video using single request with hosted URL
	// Since we provide an S3/Local public URL, we don't need resumable upload phases
	uploadURL := fmt.Sprintf("https://graph.facebook.com/v19.0/%s/videos", pageID)
	data := url.Values{}
	data.Set("file_url", video.S3URL)
	data.Set("title", video.Title)
	data.Set("description", video.Description)
	data.Set("access_token", pageToken)

	resp, err := http.PostForm(uploadURL, data)
	if err != nil {
		return "", fmt.Errorf("facebook upload request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result struct {
		ID    string `json:"id"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	if result.Error.Message != "" {
		return "", fmt.Errorf("facebook API error: %s", result.Error.Message)
	}

	return result.ID, nil
}

// GetStatus implements Platform interface
func (f *FacebookService) GetStatus(platformVideoID string) (string, error) {
	var encPageToken string
	err := f.db.QueryRow(
		"SELECT access_token FROM platform_accounts WHERE platform = 'facebook' LIMIT 1",
	).Scan(&encPageToken)
	if err != nil {
		return "", fmt.Errorf("no facebook account found: %w", err)
	}

	pageToken, err := utils.Decrypt(encPageToken)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt page token: %w", err)
	}

	statusURL := fmt.Sprintf(
		"https://graph.facebook.com/v19.0/%s?fields=status&access_token=%s",
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
func (f *FacebookService) FetchAnalytics(platformVideoID string, accountID int) (*Analytics, error) {
	var encPageToken string
	err := f.db.QueryRow(
		"SELECT access_token FROM platform_accounts WHERE id = $1", accountID,
	).Scan(&encPageToken)
	if err != nil {
		return nil, fmt.Errorf("account not found: %w", err)
	}

	pageToken, err := utils.Decrypt(encPageToken)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt page token: %w", err)
	}

	insightsURL := fmt.Sprintf(
		"https://graph.facebook.com/v19.0/%s/video_insights?metric=total_video_views,total_video_reactions_by_type_total,total_video_comments&access_token=%s",
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

// FetchRecentVideos retrieves past videos from the Facebook Page
func (f *FacebookService) FetchRecentVideos(accountID int) ([]ExternalVideo, error) {
	var encPageToken, pageID string
	err := f.db.QueryRow(
		"SELECT access_token, platform_user_id FROM platform_accounts WHERE id = $1", accountID,
	).Scan(&encPageToken, &pageID)
	if err != nil {
		return nil, fmt.Errorf("account not found: %w", err)
	}

	pageToken, err := utils.Decrypt(encPageToken)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt page token: %w", err)
	}

	// Fetch videos from Facebook Page
	// Fields: id,title,description,thumbnails,source,created_time
	videosURL := fmt.Sprintf(
		"https://graph.facebook.com/v19.0/%s/videos?fields=id,title,description,thumbnails,source,created_time&access_token=%s",
		pageID, pageToken,
	)

	resp, err := http.Get(videosURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch facebook videos: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Data []struct {
			ID          string `json:"id"`
			Title       string `json:"title"`
			Description string `json:"description"`
			Thumbnails  struct {
				Data []struct {
					URI string `json:"uri"`
				} `json:"data"`
			} `json:"thumbnails"`
			Source      string `json:"source"`
			CreatedTime string `json:"created_time"`
		} `json:"data"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to parse facebook response: %w", err)
	}

	if result.Error.Message != "" {
		return nil, fmt.Errorf("facebook API error: %s", result.Error.Message)
	}

	videos := make([]ExternalVideo, 0, len(result.Data))
	for _, item := range result.Data {
		publishedAt, _ := time.Parse(time.RFC3339, item.CreatedTime)

		thumbnail := ""
		if len(item.Thumbnails.Data) > 0 {
			thumbnail = item.Thumbnails.Data[0].URI
		}

		title := item.Title
		if title == "" {
			title = item.Description
			if idx := strings.Index(title, "\n"); idx != -1 {
				title = title[:idx]
			}
			if len(title) > 50 {
				title = title[:50] + "..."
			}
		}
		if title == "" {
			title = "Facebook Video"
		}

		videos = append(videos, ExternalVideo{
			ID:          item.ID,
			Title:       title,
			Description: item.Description,
			Thumbnail:   thumbnail,
			URL:         fmt.Sprintf("https://www.facebook.com/watch/?v=%s", item.ID),
			PublishedAt: publishedAt,
		})
	}

	return videos, nil
}

// GetStream implements Platform interface
func (f *FacebookService) GetStream(ctx context.Context, platformVideoID string) (io.ReadCloser, string, error) {
	return nil, "", fmt.Errorf("GetStream not implemented for Facebook")
}

// Notify implements Platform interface - posts to a Facebook Page or Profile
func (f *FacebookService) Notify(ctx context.Context, target models.UnifiedTarget, content models.Video) error {
	// Retrieve access token and page ID
	var encAccess, pageID string
	err := f.db.QueryRow(
		"SELECT access_token, platform_user_id FROM platform_accounts WHERE platform = 'facebook' AND platform_user_id = $1",
		target.TargetIdentifier,
	).Scan(&encAccess, &pageID)
	if err != nil {
		return fmt.Errorf("Facebook account not found: %w", err)
	}

	accessToken, err := utils.Decrypt(encAccess)
	if err != nil {
		return fmt.Errorf("failed to decrypt tokens: %w", err)
	}

	// Render content
	message := utils.RenderNotificationTemplate(target.CaptionTemplate, content, "YouTube")

	data := url.Values{}
	data.Set("message", message)
	data.Set("link", content.S3URL) // Should be final platform URL preferably
	data.Set("access_token", accessToken)

	reqURL := fmt.Sprintf("https://graph.facebook.com/v19.0/%s/feed", pageID)
	resp, err := http.PostForm(reqURL, data)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Facebook API error (%d): %s", resp.StatusCode, string(body))
	}

	return nil
}
