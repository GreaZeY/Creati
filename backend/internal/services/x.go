package services

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/base64"
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
 * TwitterService implements the Platform interface
 * Uses Twitter API v2 for authentication and video publishing
 * Note: Platform is internally called "twitter" but branded as "X"
 */
type TwitterService struct {
	db          *sql.DB
	oauthConfig *oauth2.Config
	repo        *repositories.PlatformRepository
}

// NewTwitterService creates a new Twitter/X service instance
func NewTwitterService(db *sql.DB) *TwitterService {
	return &TwitterService{
		db:   db,
		repo: repositories.NewPlatformRepository(db),
		oauthConfig: &oauth2.Config{
			ClientID:     os.Getenv("TWITTER_CLIENT_ID"),
			ClientSecret: os.Getenv("TWITTER_CLIENT_SECRET"),
			Scopes: []string{
				"tweet.read",
				"tweet.write",
				"users.read",
				"offline.access",
			},
			Endpoint: oauth2.Endpoint{
				AuthURL:   "https://twitter.com/i/oauth2/authorize",
				TokenURL:  "https://api.twitter.com/2/oauth2/token",
				AuthStyle: oauth2.AuthStyleInHeader,
			},
		},
	}
}

// GetAuthURL returns the OAuth URL for user authorization
func (t *TwitterService) GetAuthURL(state string) string {
	return t.GetAuthURLWithHint(state, "", "")
}

// GetAuthURLWithHint returns OAuth URL with optional hint/prompt
func (t *TwitterService) GetAuthURLWithHint(state, prompt, loginHint string) string {
	config := *t.oauthConfig
	config.RedirectURL = fmt.Sprintf("%s/platforms/x/callback", os.Getenv("FRONTEND_URL"))

	opts := []oauth2.AuthCodeOption{
		oauth2.SetAuthURLParam("code_challenge", generateCodeChallenge()),
		oauth2.SetAuthURLParam("code_challenge_method", "plain"),
	}

	if prompt != "" {
		opts = append(opts, oauth2.SetAuthURLParam("prompt", prompt))
	}

	// Twitter doesn't strictly follow login_hint but we add it if needed
	return config.AuthCodeURL(state, opts...)
}

func generateCodeChallenge() string {
	// In production, generate a proper random challenge and store verifier
	// For Method "plain", the challenge MUST match the verifier exactly.
	return "twitter_pkce_challenge_verifier"
}

// Authenticate implements Platform interface
func (t *TwitterService) Authenticate(code string, userID int, clientID *int) error {
	config := *t.oauthConfig
	config.RedirectURL = fmt.Sprintf("%s/platforms/x/callback", os.Getenv("FRONTEND_URL"))

	// Exchange code for token with PKCE verifier
	token, err := config.Exchange(context.Background(), code,
		oauth2.SetAuthURLParam("code_verifier", "twitter_pkce_challenge_verifier"),
	)
	if err != nil {
		return fmt.Errorf("oauth exchange failed: %w", err)
	}

	// Get user profile
	twitterUserID, name, username, profilePic, err := t.getUserProfile(token.AccessToken)
	if err != nil {
		return fmt.Errorf("failed to get profile: %w", err)
	}

	// Encrypt tokens before storing
	encAccess, err := utils.Encrypt(token.AccessToken)
	if err != nil {
		return fmt.Errorf("failed to encrypt access token: %w", err)
	}
	encRefresh, err := utils.Encrypt(token.RefreshToken)
	if err != nil {
		return fmt.Errorf("failed to encrypt refresh token: %w", err)
	}

	// Use Repository to persist account
	account := &models.PlatformAccount{
		UserID:         userID,
		ClientID:       clientID,
		Platform:       "twitter",
		AccessToken:    encAccess,
		RefreshToken:   encRefresh,
		PlatformUserID: twitterUserID,
		Status:         "connected",
		ProfileName:    name,
		Handle:         "@" + username,
		ProfilePicture: profilePic,
	}

	return t.repo.UpsertAccount(context.Background(), account)
}

// getUserProfile retrieves the user's Twitter profile
func (t *TwitterService) getUserProfile(accessToken string) (string, string, string, string, error) {
	req, err := http.NewRequest("GET", "https://api.twitter.com/2/users/me?user.fields=profile_image_url", nil)
	if err != nil {
		return "", "", "", "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", "", "", err
	}
	defer resp.Body.Close()

	var profile struct {
		Data struct {
			ID              string `json:"id"`
			Username        string `json:"username"`
			Name            string `json:"name"`
			ProfileImageURL string `json:"profile_image_url"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&profile); err != nil {
		return "", "", "", "", err
	}

	return profile.Data.ID, profile.Data.Name, profile.Data.Username, profile.Data.ProfileImageURL, nil
}

// Upload implements Platform interface - uploads video to Twitter/X
func (t *TwitterService) Upload(video *models.Video, accountID int) (string, error) {
	var encAccess, twitterUserID string
	err := t.db.QueryRow(
		"SELECT access_token, platform_user_id FROM platform_accounts WHERE id = $1", accountID,
	).Scan(&encAccess, &twitterUserID)
	if err != nil {
		return "", fmt.Errorf("account not found: %w", err)
	}

	// Decrypt token
	accessToken, err := utils.Decrypt(encAccess)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt access token: %w", err)
	}

	// Step 1: Initialize media upload (if video attached)
	var mediaID string
	if video.S3URL != "" {
		mediaID, err = t.uploadMedia(accessToken, video)
		if err != nil {
			return "", fmt.Errorf("media upload failed: %w", err)
		}
	}

	// Step 2: Create tweet with media
	tweetURL := "https://api.twitter.com/2/tweets"
	tweetBody := map[string]interface{}{
		"text": fmt.Sprintf("%s\n\n%s", video.Title, video.Description),
	}

	if mediaID != "" {
		tweetBody["media"] = map[string]interface{}{
			"media_ids": []string{mediaID},
		}
	}

	bodyBytes, _ := json.Marshal(tweetBody)
	req, err := http.NewRequest("POST", tweetURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to create tweet: %w", err)
	}
	defer resp.Body.Close()

	var tweetResult struct {
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&tweetResult); err != nil {
		return "", err
	}

	if len(tweetResult.Errors) > 0 {
		return "", fmt.Errorf("twitter error: %s", tweetResult.Errors[0].Message)
	}

	return tweetResult.Data.ID, nil
}

// uploadMedia handles chunked video upload to Twitter
func (t *TwitterService) uploadMedia(accessToken string, video *models.Video) (string, error) {
	// Download video to temp file for reliable chunked upload
	tmpFile, err := utils.DownloadToTempFile(video.S3URL)
	if err != nil {
		return "", fmt.Errorf("failed to download video to temp file: %w", err)
	}
	defer func() {
		tmpFile.Close()
		os.Remove(tmpFile.Name())
	}()

	fileInfo, err := tmpFile.Stat()
	if err != nil {
		return "", err
	}
	totalBytes := fileInfo.Size()

	client := &http.Client{}
	mediaUploadURL := "https://upload.twitter.com/1.1/media/upload.json"

	// INIT
	initData := url.Values{}
	initData.Set("command", "INIT")
	initData.Set("media_type", "video/mp4")
	initData.Set("total_bytes", fmt.Sprintf("%d", totalBytes))
	initData.Set("media_category", "tweet_video")

	initReq, err := http.NewRequest("POST", mediaUploadURL, bytes.NewBufferString(initData.Encode()))
	if err != nil {
		return "", err
	}
	initReq.Header.Set("Authorization", "Bearer "+accessToken)
	initReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	initResp, err := client.Do(initReq)
	if err != nil {
		return "", err
	}
	defer initResp.Body.Close()

	var initResult struct {
		MediaIDString string `json:"media_id_string"`
	}
	if err := json.NewDecoder(initResp.Body).Decode(&initResult); err != nil {
		return "", err
	}

	mediaID := initResult.MediaIDString

	// APPEND (chunked upload)
	chunkSize := 5 * 1024 * 1024 // 5MB chunks
	for i := int64(0); i < totalBytes; i += int64(chunkSize) {
		size := int64(chunkSize)
		if i+size > totalBytes {
			size = totalBytes - i
		}

		chunk := make([]byte, size)
		if _, err := tmpFile.ReadAt(chunk, i); err != nil {
			return "", fmt.Errorf("failed to read chunk: %w", err)
		}

		appendData := url.Values{}
		appendData.Set("command", "APPEND")
		appendData.Set("media_id", mediaID)
		appendData.Set("segment_index", fmt.Sprintf("%d", i/int64(chunkSize)))
		appendData.Set("media_data", base64.StdEncoding.EncodeToString(chunk))

		appendReq, err := http.NewRequest("POST", mediaUploadURL, bytes.NewBufferString(appendData.Encode()))
		if err != nil {
			return "", err
		}
		appendReq.Header.Set("Authorization", "Bearer "+accessToken)
		appendReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

		appendResp, err := client.Do(appendReq)
		if err != nil {
			return "", err
		}
		appendResp.Body.Close()
	}

	// FINALIZE
	finalizeData := url.Values{}
	finalizeData.Set("command", "FINALIZE")
	finalizeData.Set("media_id", mediaID)

	finalizeReq, err := http.NewRequest("POST", mediaUploadURL, bytes.NewBufferString(finalizeData.Encode()))
	if err != nil {
		return "", err
	}
	finalizeReq.Header.Set("Authorization", "Bearer "+accessToken)
	finalizeReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	finalizeResp, err := client.Do(finalizeReq)
	if err != nil {
		return "", err
	}
	defer finalizeResp.Body.Close()

	var finalizeResult struct {
		MediaIDString  string `json:"media_id_string"`
		ProcessingInfo *struct {
			State          string `json:"state"`
			CheckAfterSecs int    `json:"check_after_secs"`
		} `json:"processing_info"`
	}
	if err := json.NewDecoder(finalizeResp.Body).Decode(&finalizeResult); err != nil {
		return "", err
	}

	// Wait for processing if needed
	if finalizeResult.ProcessingInfo != nil {
		for finalizeResult.ProcessingInfo.State == "pending" || finalizeResult.ProcessingInfo.State == "in_progress" {
			time.Sleep(time.Duration(finalizeResult.ProcessingInfo.CheckAfterSecs) * time.Second)

			statusData := url.Values{}
			statusData.Set("command", "STATUS")
			statusData.Set("media_id", mediaID)

			statusReq, err := http.NewRequest("GET", mediaUploadURL+"?"+statusData.Encode(), nil)
			if err != nil {
				return "", err
			}
			statusReq.Header.Set("Authorization", "Bearer "+accessToken)

			statusResp, err := client.Do(statusReq)
			if err != nil {
				return "", err
			}

			json.NewDecoder(statusResp.Body).Decode(&finalizeResult)
			statusResp.Body.Close()

			if finalizeResult.ProcessingInfo != nil && finalizeResult.ProcessingInfo.State == "failed" {
				return "", fmt.Errorf("video processing failed")
			}
		}
	}

	return mediaID, nil
}

// GetStatus implements Platform interface
func (t *TwitterService) GetStatus(platformVideoID string) (string, error) {
	return "completed", nil
}

// FetchAnalytics implements Platform interface
func (t *TwitterService) FetchAnalytics(platformVideoID string, accountID int) (*Analytics, error) {
	var encAccess string
	err := t.db.QueryRow(
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

	// Get tweet metrics
	metricsURL := fmt.Sprintf(
		"https://api.twitter.com/2/tweets/%s?tweet.fields=public_metrics",
		platformVideoID,
	)

	req, err := http.NewRequest("GET", metricsURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var metricsResult struct {
		Data struct {
			PublicMetrics struct {
				ImpressionCount int64 `json:"impression_count"`
				LikeCount       int64 `json:"like_count"`
				ReplyCount      int64 `json:"reply_count"`
				RetweetCount    int64 `json:"retweet_count"`
			} `json:"public_metrics"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&metricsResult); err != nil {
		return nil, err
	}

	metrics := metricsResult.Data.PublicMetrics
	return &Analytics{
		Views:    metrics.ImpressionCount,
		Likes:    metrics.LikeCount,
		Comments: metrics.ReplyCount,
		Shares:   metrics.RetweetCount,
	}, nil
}

// FetchRecentVideos retrieves past videos from X
func (t *TwitterService) FetchRecentVideos(accountID int) ([]ExternalVideo, error) {
	var encAccess, twitterUserID string
	err := t.db.QueryRow(
		"SELECT access_token, platform_user_id FROM platform_accounts WHERE id = $1", accountID,
	).Scan(&encAccess, &twitterUserID)
	if err != nil {
		return nil, fmt.Errorf("account not found: %w", err)
	}

	accessToken, err := utils.Decrypt(encAccess)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt access token: %w", err)
	}

	// Twitter API v2: Get user tweets with media expansions
	// We need expansions=attachments.media_keys to get media info
	// max_results=50 to get a good history
	url := fmt.Sprintf("https://api.twitter.com/2/users/%s/tweets?expansions=attachments.media_keys&media.fields=url,preview_image_url,variants,type&tweet.fields=created_at,text&max_results=50", twitterUserID)

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch tweets: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Data []struct {
			ID          string    `json:"id"`
			Text        string    `json:"text"`
			CreatedAt   time.Time `json:"created_at"`
			Attachments struct {
				MediaKeys []string `json:"media_keys"`
			} `json:"attachments"`
		} `json:"data"`
		Includes struct {
			Media []struct {
				MediaKey     string `json:"media_key"`
				Type         string `json:"type"`
				URL          string `json:"url"`
				PreviewImage string `json:"preview_image_url"`
				Variants     []struct {
					URL         string `json:"url"`
					ContentType string `json:"content_type"`
				} `json:"variants"`
			} `json:"media"`
		} `json:"includes"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to parse twitter response: %w", err)
	}

	if len(result.Errors) > 0 {
		return nil, fmt.Errorf("twitter API error: %s", result.Errors[0].Message)
	}

	videos := make([]ExternalVideo, 0)
	for _, tweet := range result.Data {
		if len(tweet.Attachments.MediaKeys) == 0 {
			continue
		}

		// Find the first video in this tweet's media keys
		for _, mk := range tweet.Attachments.MediaKeys {
			found := false
			for _, m := range result.Includes.Media {
				if m.MediaKey == mk && m.Type == "video" {
					thumbnail := m.PreviewImage
					if thumbnail == "" && m.URL != "" {
						thumbnail = m.URL
					}

					videos = append(videos, ExternalVideo{
						ID:          tweet.ID,
						Title:       tweet.Text,
						Description: tweet.Text,
						Thumbnail:   thumbnail,
						URL:         fmt.Sprintf("https://twitter.com/i/status/%s", tweet.ID),
						PublishedAt: tweet.CreatedAt,
					})
					found = true
					break
				}
			}
			if found {
				break
			}
		}
	}

	return videos, nil
}

// GetStream implements Platform interface
func (t *TwitterService) GetStream(ctx context.Context, platformVideoID string) (io.ReadCloser, string, error) {
	variant, err := t.getBestVariant(ctx, platformVideoID)
	if err != nil {
		return nil, "", err
	}

	resp, err := http.Get(variant.URL)
	if err != nil {
		return nil, "", fmt.Errorf("failed to fetch video stream: %w", err)
	}

	return resp.Body, resp.Header.Get("Content-Type"), nil
}

// DownloadHighQuality implements HighQualityDownloader interface
func (t *TwitterService) DownloadHighQuality(ctx context.Context, platformVideoID string, destPath string) error {
	variant, err := t.getBestVariant(ctx, platformVideoID)
	if err != nil {
		return err
	}

	return DownloadVariantToFile(ctx, variant, destPath)
}

func (t *TwitterService) getBestVariant(ctx context.Context, platformVideoID string) (*MediaVariant, error) {
	// 1. Get access token
	var encAccess string
	err := t.db.QueryRowContext(ctx,
		"SELECT access_token FROM platform_accounts WHERE platform = 'twitter' AND status = 'connected' ORDER BY COALESCE(updated_at, connected_at) DESC LIMIT 1",
	).Scan(&encAccess)
	if err != nil {
		return nil, fmt.Errorf("no twitter account available: %w", err)
	}

	accessToken, err := utils.Decrypt(encAccess)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt tokens: %w", err)
	}

	// 2. Fetch Tweet details with media expansions
	reqURL := fmt.Sprintf("https://api.twitter.com/2/tweets/%s?expansions=attachments.media_keys&media.fields=url,variants,type", platformVideoID)
	req, _ := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call twitter api: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Includes struct {
			Media []struct {
				Type     string `json:"type"`
				Variants []struct {
					URL         string `json:"url"`
					ContentType string `json:"content_type"`
					Bitrate     int    `json:"bitrate"`
				} `json:"variants"`
			} `json:"media"`
		} `json:"includes"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode twitter response: %w", err)
	}

	if len(result.Includes.Media) == 0 {
		return nil, fmt.Errorf("no media found in tweet")
	}

	// Map to MediaVariant
	var variants []MediaVariant
	for _, m := range result.Includes.Media {
		if m.Type != "video" {
			continue
		}
		for _, v := range m.Variants {
			if !strings.Contains(v.ContentType, "video") {
				continue
			}
			variants = append(variants, MediaVariant{
				URL:      v.URL,
				MimeType: v.ContentType,
				Bitrate:  v.Bitrate,
				HasAudio: true, // X variants usually have combined audio/video
				HasVideo: true,
				Height:   1080, // Default to 1080 as height is often not in variants field directly
			})
		}
	}

	best := SelectBestVariant(variants, "")
	if best == nil {
		return nil, fmt.Errorf("no suitable video variants found for tweet")
	}

	return best, nil
}

// Notify implements Platform interface - posts a tweet announcement
func (x *TwitterService) Notify(ctx context.Context, target models.UnifiedTarget, content models.Video) error {
	// Retrieve access token
	var encAccess string
	err := x.db.QueryRow(
		"SELECT access_token FROM platform_accounts WHERE platform = 'twitter' AND platform_user_id = $1",
		target.TargetIdentifier,
	).Scan(&encAccess)
	if err != nil {
		return fmt.Errorf("X account not found: %w", err)
	}

	accessToken, err := utils.Decrypt(encAccess)
	if err != nil {
		return fmt.Errorf("failed to decrypt tokens: %w", err)
	}

	// Render content
	message := utils.RenderNotificationTemplate(target.CaptionTemplate, content, "YouTube")
	// X has a 280-char limit for basic accounts, but we'll let the API return error if exceeded

	// Prepare payload
	payload := map[string]string{
		"text": message,
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.twitter.com/2/tweets", strings.NewReader(string(jsonPayload)))
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("X API error (%d): %s", resp.StatusCode, string(body))
	}

	return nil
}
