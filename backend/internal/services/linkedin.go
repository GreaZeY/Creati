package services

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"

	"example.com/creati/backend/internal/db/models"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/linkedin"
)

/**
 * LinkedInService implements the Platform interface
 * Uses LinkedIn Marketing API for authentication and video publishing
 */
type LinkedInService struct {
	db          *sql.DB
	oauthConfig *oauth2.Config
}

// NewLinkedInService creates a new LinkedIn service instance
func NewLinkedInService(db *sql.DB) *LinkedInService {
	return &LinkedInService{
		db: db,
		oauthConfig: &oauth2.Config{
			ClientID:     os.Getenv("LINKEDIN_CLIENT_ID"),
			ClientSecret: os.Getenv("LINKEDIN_CLIENT_SECRET"),
			Scopes: []string{
				"openid",
				"profile",
				"w_member_social",
			},
			Endpoint: linkedin.Endpoint,
		},
	}
}

// GetAuthURL returns the OAuth URL for user authorization
func (l *LinkedInService) GetAuthURL(state string) string {
	config := *l.oauthConfig
	config.RedirectURL = fmt.Sprintf("%s/platforms/linkedin/callback", os.Getenv("FRONTEND_URL"))
	return config.AuthCodeURL(state, oauth2.AccessTypeOffline)
}

// Authenticate implements Platform interface
func (l *LinkedInService) Authenticate(code string, userID int) error {
	config := *l.oauthConfig
	config.RedirectURL = fmt.Sprintf("%s/platforms/linkedin/callback", os.Getenv("FRONTEND_URL"))

	// Exchange code for token
	token, err := config.Exchange(context.Background(), code)
	if err != nil {
		return fmt.Errorf("oauth exchange failed: %w", err)
	}

	// Get user profile info
	profileID, profileName, err := l.getUserProfile(token.AccessToken)
	if err != nil {
		return fmt.Errorf("failed to get profile: %w", err)
	}

	// Store tokens in database
	query := `
		INSERT INTO platform_accounts (user_id, platform, access_token, refresh_token, platform_user_id, status, profile_name)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (user_id, platform, platform_user_id) 
		DO UPDATE SET access_token = $3, refresh_token = $4, status = $6, profile_name = $7, connected_at = NOW()
	`
	refreshToken := ""
	if token.RefreshToken != "" {
		refreshToken = token.RefreshToken
	}
	_, err = l.db.Exec(query, userID, "linkedin", token.AccessToken, refreshToken, profileID, "connected", profileName)
	return err
}

// getUserProfile retrieves the user's LinkedIn profile
func (l *LinkedInService) getUserProfile(accessToken string) (string, string, error) {
	req, err := http.NewRequest("GET", "https://api.linkedin.com/v2/userinfo", nil)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	var profile struct {
		Sub   string `json:"sub"`
		Name  string `json:"name"`
		Email string `json:"email"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&profile); err != nil {
		return "", "", err
	}

	return profile.Sub, profile.Name, nil
}

// Upload implements Platform interface - uploads video to LinkedIn
func (l *LinkedInService) Upload(video *models.Video, accountID int) (string, error) {
	var accessToken, profileID string
	err := l.db.QueryRow(
		"SELECT access_token, platform_user_id FROM platform_accounts WHERE id = $1", accountID,
	).Scan(&accessToken, &profileID)
	if err != nil {
		return "", fmt.Errorf("account not found: %w", err)
	}

	// Step 1: Register video upload
	registerURL := "https://api.linkedin.com/v2/videos?action=initializeUpload"
	registerBody := map[string]interface{}{
		"initializeUploadRequest": map[string]interface{}{
			"owner":           fmt.Sprintf("urn:li:person:%s", profileID),
			"fileSizeBytes":   0, // Will be determined during upload
			"uploadCaptions":  false,
			"uploadThumbnail": false,
		},
	}

	bodyBytes, _ := json.Marshal(registerBody)
	req, err := http.NewRequest("POST", registerURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Restli-Protocol-Version", "2.0.0")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to register upload: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var registerResult struct {
		Value struct {
			UploadInstructions []struct {
				UploadURL string `json:"uploadUrl"`
			} `json:"uploadInstructions"`
			Video string `json:"video"`
		} `json:"value"`
	}

	if err := json.Unmarshal(body, &registerResult); err != nil {
		return "", fmt.Errorf("failed to parse register response: %w", err)
	}

	videoURN := registerResult.Value.Video

	// Step 2: Download video from S3 and upload to LinkedIn
	// In production, this should stream the video
	videoResp, err := http.Get(video.S3URL)
	if err != nil {
		return "", fmt.Errorf("failed to download video: %w", err)
	}
	defer videoResp.Body.Close()

	if len(registerResult.Value.UploadInstructions) > 0 {
		uploadURL := registerResult.Value.UploadInstructions[0].UploadURL
		uploadReq, err := http.NewRequest("PUT", uploadURL, videoResp.Body)
		if err != nil {
			return "", err
		}
		uploadReq.Header.Set("Content-Type", "application/octet-stream")

		uploadResp, err := client.Do(uploadReq)
		if err != nil {
			return "", fmt.Errorf("failed to upload video: %w", err)
		}
		uploadResp.Body.Close()
	}

	// Step 3: Create post with video
	postURL := "https://api.linkedin.com/v2/posts"
	postBody := map[string]interface{}{
		"author":     fmt.Sprintf("urn:li:person:%s", profileID),
		"commentary": fmt.Sprintf("%s\n\n%s", video.Title, video.Description),
		"visibility": "PUBLIC",
		"distribution": map[string]interface{}{
			"feedDistribution":               "MAIN_FEED",
			"targetEntities":                 []interface{}{},
			"thirdPartyDistributionChannels": []interface{}{},
		},
		"content": map[string]interface{}{
			"media": map[string]interface{}{
				"title": video.Title,
				"id":    videoURN,
			},
		},
		"lifecycleState":            "PUBLISHED",
		"isReshareDisabledByAuthor": false,
	}

	postBytes, _ := json.Marshal(postBody)
	postReq, err := http.NewRequest("POST", postURL, bytes.NewBuffer(postBytes))
	if err != nil {
		return "", err
	}
	postReq.Header.Set("Authorization", "Bearer "+accessToken)
	postReq.Header.Set("Content-Type", "application/json")
	postReq.Header.Set("X-Restli-Protocol-Version", "2.0.0")

	postResp, err := client.Do(postReq)
	if err != nil {
		return "", fmt.Errorf("failed to create post: %w", err)
	}
	defer postResp.Body.Close()

	// Get post ID from response header
	postID := postResp.Header.Get("X-RestLi-Id")
	if postID == "" {
		postID = videoURN // Fallback to video URN
	}

	return postID, nil
}

// GetStatus implements Platform interface
func (l *LinkedInService) GetStatus(platformVideoID string) (string, error) {
	// LinkedIn doesn't have a separate processing status endpoint
	return "completed", nil
}

// FetchAnalytics implements Platform interface
func (l *LinkedInService) FetchAnalytics(platformVideoID string, accountID int) (*Analytics, error) {
	var accessToken string
	err := l.db.QueryRow(
		"SELECT access_token FROM platform_accounts WHERE id = $1", accountID,
	).Scan(&accessToken)
	if err != nil {
		return nil, fmt.Errorf("account not found: %w", err)
	}

	// LinkedIn analytics require Marketing Developer Platform access
	// Basic stats can be retrieved from share statistics
	statsURL := fmt.Sprintf(
		"https://api.linkedin.com/v2/socialActions/%s",
		platformVideoID,
	)

	req, err := http.NewRequest("GET", statsURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("X-Restli-Protocol-Version", "2.0.0")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var stats struct {
		LikesSummary struct {
			TotalLikes int64 `json:"totalLikes"`
		} `json:"likesSummary"`
		CommentsSummary struct {
			TotalFirstLevelComments int64 `json:"totalFirstLevelComments"`
		} `json:"commentsSummary"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&stats); err != nil {
		return nil, err
	}

	return &Analytics{
		Likes:    stats.LikesSummary.TotalLikes,
		Comments: stats.CommentsSummary.TotalFirstLevelComments,
	}, nil
}
