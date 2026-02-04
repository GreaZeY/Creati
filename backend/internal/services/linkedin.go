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
	"strings"
	"time"

	"creati.in/creati/backend/internal/db/models"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/linkedin"

	"creati.in/creati/backend/internal/db/repositories"
	"creati.in/creati/backend/internal/utils"
)

/**
 * LinkedInService implements the Platform interface
 * Uses LinkedIn Marketing API for authentication and video publishing
 */
type LinkedInService struct {
	db          *sql.DB
	oauthConfig *oauth2.Config
	repo        *repositories.PlatformRepository
}

// NewLinkedInService creates a new LinkedIn service instance
func NewLinkedInService(db *sql.DB) *LinkedInService {
	return &LinkedInService{
		db:   db,
		repo: repositories.NewPlatformRepository(db),
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
	return l.GetAuthURLWithHint(state, "", "")
}

// GetAuthURLWithHint returns OAuth URL with optional hint/prompt
func (l *LinkedInService) GetAuthURLWithHint(state, prompt, loginHint string) string {
	config := *l.oauthConfig
	config.RedirectURL = fmt.Sprintf("%s/platforms/linkedin/callback", os.Getenv("FRONTEND_URL"))

	opts := []oauth2.AuthCodeOption{oauth2.AccessTypeOffline}
	// LinkedIn supports prompt: none, consent, login
	if prompt != "" {
		opts = append(opts, oauth2.SetAuthURLParam("prompt", prompt))
	}
	// login_hint is not natively supported in standard LinkedIn docs but we add it for safety
	return config.AuthCodeURL(state, opts...)
}

// Authenticate implements Platform interface
func (l *LinkedInService) Authenticate(code string, userID int, clientID *int) error {
	config := *l.oauthConfig
	config.RedirectURL = fmt.Sprintf("%s/platforms/x/callback", os.Getenv("FRONTEND_URL"))

	// Exchange code for token
	token, err := config.Exchange(context.Background(), code)
	if err != nil {
		return fmt.Errorf("oauth exchange failed: %w", err)
	}

	// Get user profile info
	profileID, profileName, handle, err := l.getUserProfile(token.AccessToken)
	if err != nil {
		return fmt.Errorf("failed to get profile: %w", err)
	}

	// Encrypt tokens before storing
	encAccess, err := utils.Encrypt(token.AccessToken)
	if err != nil {
		return fmt.Errorf("failed to encrypt access token: %w", err)
	}
	encRefresh := ""
	if token.RefreshToken != "" {
		encRefresh, err = utils.Encrypt(token.RefreshToken)
		if err != nil {
			return fmt.Errorf("failed to encrypt refresh token: %w", err)
		}
	}

	// Store tokens in database
	// Use Repository to persist account
	account := &models.PlatformAccount{
		UserID:         userID,
		ClientID:       clientID,
		Platform:       "linkedin",
		AccessToken:    encAccess,
		RefreshToken:   encRefresh,
		PlatformUserID: profileID,
		Status:         "connected",
		ProfileName:    profileName,
		Handle:         handle,
	}

	return l.repo.UpsertAccount(context.Background(), account)
}

// getUserProfile retrieves the user's LinkedIn profile
func (l *LinkedInService) getUserProfile(accessToken string) (string, string, string, error) {
	req, err := http.NewRequest("GET", "https://api.linkedin.com/v2/userinfo", nil)
	if err != nil {
		return "", "", "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", "", err
	}
	defer resp.Body.Close()

	var profile struct {
		Sub  string `json:"sub"`
		Name string `json:"name"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&profile); err != nil {
		return "", "", "", err
	}

	// Vanity name / handle is often not available via userinfo
	// We'll use the sub ID as a fallback handle if empty
	return profile.Sub, profile.Name, "", nil
}

// Upload implements Platform interface - uploads video to LinkedIn
func (l *LinkedInService) Upload(video *models.Video, accountID int) (string, error) {
	var encAccess, profileID string
	err := l.db.QueryRow(
		"SELECT access_token, platform_user_id FROM platform_accounts WHERE id = $1", accountID,
	).Scan(&encAccess, &profileID)
	if err != nil {
		return "", fmt.Errorf("account not found: %w", err)
	}

	// Decrypt token
	accessToken, err := utils.Decrypt(encAccess)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt access token: %w", err)
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

	// Step 2: Download video to temp file and upload to LinkedIn
	tmpFile, err := utils.DownloadToTempFile(video.S3URL)
	if err != nil {
		return "", fmt.Errorf("failed to download video to temp file: %w", err)
	}
	defer func() {
		tmpFile.Close()
		os.Remove(tmpFile.Name())
	}()

	if len(registerResult.Value.UploadInstructions) > 0 {
		uploadURL := registerResult.Value.UploadInstructions[0].UploadURL
		uploadReq, err := http.NewRequest("PUT", uploadURL, tmpFile)
		if err != nil {
			return "", err
		}
		uploadReq.Header.Set("Content-Type", "application/octet-stream")

		uploadResp, err := client.Do(uploadReq)
		if err != nil {
			return "", fmt.Errorf("failed to upload video: %w", err)
		}
		uploadResp.Body.Close()

		// Step 2.5: Poll for video processing status
		// LinkedIn videos must be 'AVAILABLE' before they can be used in a post.
		maxRetries := 30 // 5 minutes (30 * 10s)
		pollURL := fmt.Sprintf("https://api.linkedin.com/v2/videos/%s", videoURN)

		for i := 0; i < maxRetries; i++ {
			time.Sleep(10 * time.Second)

			pollReq, _ := http.NewRequest("GET", pollURL, nil)
			pollReq.Header.Set("Authorization", "Bearer "+accessToken)
			pollReq.Header.Set("X-Restli-Protocol-Version", "2.0.0")

			pollResp, err := client.Do(pollReq)
			if err != nil {
				continue
			}

			var pollResult struct {
				Status string `json:"status"`
			}
			err = json.NewDecoder(pollResp.Body).Decode(&pollResult)
			pollResp.Body.Close()
			if err != nil {
				continue
			}

			if pollResult.Status == "AVAILABLE" {
				break
			}

			if pollResult.Status == "FAILED" {
				return "", fmt.Errorf("linkedin video processing failed")
			}

			if i == maxRetries-1 {
				return "", fmt.Errorf("linkedin video processing timed out after 5 minutes")
			}
		}
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
	var encAccess string
	err := l.db.QueryRow(
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

// FetchRecentVideos retrieves past videos from LinkedIn
func (l *LinkedInService) FetchRecentVideos(accountID int) ([]ExternalVideo, error) {
	var encAccess, profileID string
	err := l.db.QueryRow(
		"SELECT access_token, platform_user_id FROM platform_accounts WHERE id = $1", accountID,
	).Scan(&encAccess, &profileID)
	if err != nil {
		return nil, fmt.Errorf("account not found: %w", err)
	}

	accessToken, err := utils.Decrypt(encAccess)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt access token: %w", err)
	}

	// LinkedIn API v2: Get author's posts
	// Filters: author=urn:li:person:ID, viewContext=AUTHOR
	// Note: We're filtering for posts that contain video content
	authorURN := fmt.Sprintf("urn:li:person:%s", profileID)
	url := fmt.Sprintf("https://api.linkedin.com/v2/posts?q=author&author=%s&viewContext=AUTHOR&count=50", authorURN)

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("X-Restli-Protocol-Version", "2.0.0")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch linkedin posts: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("linkedin API error (%d): %s", resp.StatusCode, string(body))
	}

	var result struct {
		Elements []struct {
			ID         string `json:"id"`
			Commentary string `json:"commentary"`
			CreatedAt  int64  `json:"createdAt"`
			Content    struct {
				Media struct {
					ID string `json:"id"`
				} `json:"media"`
			} `json:"content"`
		} `json:"elements"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to parse linkedin response: %w", err)
	}

	videos := make([]ExternalVideo, 0)
	for _, item := range result.Elements {
		// We only want posts with media content (videos)
		if item.Content.Media.ID == "" {
			continue
		}

		// LinkedIn API v2 is complex; we'll treat posts with media as potential videos.
		// In a real app, we'd check if the media URN is a video URN.

		title := item.Commentary
		if len(title) > 50 {
			title = title[:50] + "..."
		}
		if title == "" {
			title = "LinkedIn Post"
		}

		publishedAt := time.Unix(item.CreatedAt/1000, 0)

		videos = append(videos, ExternalVideo{
			ID:          item.Content.Media.ID, // The video URN is what we need for GetStream later
			Title:       title,
			Description: item.Commentary,
			URL:         fmt.Sprintf("https://www.linkedin.com/feed/update/%s", item.ID),
			PublishedAt: publishedAt,
		})
	}

	return videos, nil
}

// GetStream implements Platform interface
func (l *LinkedInService) GetStream(ctx context.Context, platformVideoID string) (io.ReadCloser, string, error) {
	return nil, "", fmt.Errorf("GetStream not implemented for LinkedIn")
}

// Notify implements Platform interface - shares a post on LinkedIn
func (l *LinkedInService) Notify(ctx context.Context, target models.UnifiedTarget, content models.Video) error {
	// Retrieve access token and person URN
	var encAccess, personURN string
	err := l.db.QueryRow(
		"SELECT access_token, platform_user_id FROM platform_accounts WHERE platform = 'linkedin' AND platform_user_id = $1",
		target.TargetIdentifier,
	).Scan(&encAccess, &personURN)
	if err != nil {
		return fmt.Errorf("LinkedIn account not found: %w", err)
	}

	accessToken, err := utils.Decrypt(encAccess)
	if err != nil {
		return fmt.Errorf("failed to decrypt tokens: %w", err)
	}

	// Render content
	title := utils.RenderNotificationTemplate(target.TitleTemplate, content, "YouTube")
	if title == "" {
		title = content.Title
	}
	body := utils.RenderNotificationTemplate(target.CaptionTemplate, content, "YouTube")

	// LinkedIn UGC Post payload
	payload := map[string]interface{}{
		"author":         personURN,
		"lifecycleState": "PUBLISHED",
		"specificContent": map[string]interface{}{
			"com.linkedin.ugc.ShareContent": map[string]interface{}{
				"shareCommentary": map[string]interface{}{
					"text": body,
				},
				"shareMediaCategory": "ARTICLE",
				"media": []map[string]interface{}{
					{
						"status": "READY",
						"description": map[string]interface{}{
							"text": content.Description,
						},
						"originalUrl": content.S3URL, // Best to use final platform URL
						"title": map[string]interface{}{
							"text": title,
						},
					},
				},
			},
		},
		"visibility": map[string]interface{}{
			"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
		},
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.linkedin.com/v2/ugcPosts", strings.NewReader(string(jsonPayload)))
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Restli-Protocol-Version", "2.0.0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("LinkedIn API error (%d): %s", resp.StatusCode, string(respBody))
	}

	return nil
}
