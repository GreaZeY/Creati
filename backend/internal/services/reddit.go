package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"

	"example.com/creati/backend/internal/db/models"
	"golang.org/x/oauth2"
)

/**
 * RedditService implements the Platform interface
 * Handles authentication and posting to subreddits
 */
type RedditService struct {
	db          *sql.DB
	oauthConfig *oauth2.Config
	userAgent   string
}

// NewRedditService creates a new Reddit service instance
func NewRedditService(db *sql.DB) *RedditService {
	return &RedditService{
		db: db,
		oauthConfig: &oauth2.Config{
			ClientID:     os.Getenv("REDDIT_CLIENT_ID"),
			ClientSecret: os.Getenv("REDDIT_CLIENT_SECRET"),
			RedirectURL:  os.Getenv("REDDIT_REDIRECT_URL"),
			Scopes: []string{
				"identity",
				"submit",
				"read",
				"history",
			},
			Endpoint: oauth2.Endpoint{
				AuthURL:  "https://www.reddit.com/api/v1/authorize",
				TokenURL: "https://www.reddit.com/api/v1/access_token",
			},
		},
		userAgent: "CreatiDistributor/0.1 by GreaZeY", // Reddit requires a descriptive User-Agent
	}
}

// GetAuthURL returns the OAuth URL for user authorization
func (r *RedditService) GetAuthURL(state string) string {
	return r.oauthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline, oauth2.SetAuthURLParam("duration", "permanent"))
}

// Authenticate implements Platform interface
func (r *RedditService) Authenticate(code string, userID int) error {
	ctx := context.Background()
	// Reddit requires Basic Auth for token exchange
	token, err := r.oauthConfig.Exchange(ctx, code)
	if err != nil {
		return fmt.Errorf("oauth exchange failed: %w", err)
	}

	// Fetch user info
	client := r.oauthConfig.Client(ctx, token)
	req, _ := http.NewRequest("GET", "https://oauth.reddit.com/api/v1/me", nil)
	req.Header.Set("User-Agent", r.userAgent)

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to get user info: %w", err)
	}
	defer resp.Body.Close()

	var user struct {
		Name string `json:"name"`
		ID   string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return fmt.Errorf("failed to decode user info: %w", err)
	}

	// Store tokens in database
	query := `
		INSERT INTO platform_accounts (user_id, platform, access_token, refresh_token, status, profile_name, platform_user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (user_id, platform, platform_user_id) 
		DO UPDATE SET access_token = $3, refresh_token = $4, status = $5, profile_name = $6, connected_at = NOW()
	`
	_, err = r.db.Exec(query, userID, "reddit", token.AccessToken, token.RefreshToken, "connected", user.Name, user.ID)
	return err
}

// Upload implements Platform interface - posts to Reddit
// Since Reddit video uploads are complex (require websocket/handshake),
// we initially support posting the S3 URL as a link post or using Reddit's submit API for links.
func (r *RedditService) Upload(video *models.Video, accountID int) (string, error) {
	var accessToken string
	err := r.db.QueryRow(
		"SELECT access_token FROM platform_accounts WHERE id = $1", accountID,
	).Scan(&accessToken)
	if err != nil {
		return "", fmt.Errorf("account not found: %w", err)
	}

	// In a real app, we'd let user choose a subreddit.
	// For MVP, we'll try to post to their own profile or a default subreddit if we had one.
	// Reddit submit API: https://www.reddit.com/dev/api/#POST_api_submit

	submitURL := "https://oauth.reddit.com/api/submit"
	data := url.Values{}
	data.Set("sr", "u_"+video.Title) // Reddit uses u_username for user profiles, but we need the actual username
	// For now, let's assume we post to a "testing" subreddit or similar if we can't get the user's name easily here.
	// Actually, we should have stored the ProfileName.

	var profileName string
	_ = r.db.QueryRow("SELECT profile_name FROM platform_accounts WHERE user_id = $1 AND platform = 'reddit'", video.UserID).Scan(&profileName)

	data.Set("sr", "u_"+profileName)
	data.Set("kind", "link")
	data.Set("title", video.Title)
	data.Set("url", video.S3URL)
	data.Set("resubmit", "true")

	req, _ := http.NewRequest("POST", submitURL, strings.NewReader(data.Encode()))
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", r.userAgent)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		JSON struct {
			Errors [][]string `json:"errors"`
			Data   struct {
				ID string `json:"id"`
			} `json:"data"`
		} `json:"json"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	if len(result.JSON.Errors) > 0 {
		return "", fmt.Errorf("reddit api error: %v", result.JSON.Errors[0])
	}

	return result.JSON.Data.ID, nil
}

// GetStatus implements Platform interface
func (r *RedditService) GetStatus(platformVideoID string) (string, error) {
	return "completed", nil
}

// FetchAnalytics implements Platform interface
func (r *RedditService) FetchAnalytics(platformVideoID string, accountID int) (*Analytics, error) {
	var accessToken string
	err := r.db.QueryRow(
		"SELECT access_token FROM platform_accounts WHERE id = $1", accountID,
	).Scan(&accessToken)
	if err != nil {
		return nil, fmt.Errorf("account not found: %w", err)
	}

	// https://www.reddit.com/dev/api/#GET_api_info
	// platformVideoID for reddit posts is usually like t3_xxxxx
	id := platformVideoID
	if !strings.HasPrefix(id, "t3_") {
		id = "t3_" + id
	}

	infoURL := fmt.Sprintf("https://oauth.reddit.com/api/info?id=%s", id)
	req, _ := http.NewRequest("GET", infoURL, nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("User-Agent", r.userAgent)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Data struct {
			Children []struct {
				Data struct {
					Score       int64 `json:"score"`
					NumComments int64 `json:"num_comments"`
					Ups         int64 `json:"ups"`
				} `json:"data"`
			} `json:"children"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if len(result.Data.Children) == 0 {
		return nil, fmt.Errorf("post not found")
	}

	post := result.Data.Children[0].Data
	return &Analytics{
		Likes:    post.Ups, // Reddit uses score/ups for likes
		Comments: post.NumComments,
	}, nil
}
