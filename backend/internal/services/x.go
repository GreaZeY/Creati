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
	"time"

	"example.com/creati/backend/internal/db/models"

	"golang.org/x/oauth2"
)

/**
 * TwitterService implements the Platform interface
 * Uses Twitter API v2 for authentication and video publishing
 * Note: Platform is internally called "twitter" but branded as "X"
 */
type TwitterService struct {
	db          *sql.DB
	oauthConfig *oauth2.Config
}

// NewTwitterService creates a new Twitter/X service instance
func NewTwitterService(db *sql.DB) *TwitterService {
	return &TwitterService{
		db: db,
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
				AuthURL:  "https://twitter.com/i/oauth2/authorize",
				TokenURL: "https://api.twitter.com/2/oauth2/token",
			},
		},
	}
}

// GetAuthURL returns the OAuth URL for user authorization
func (t *TwitterService) GetAuthURL(state string) string {
	config := *t.oauthConfig
	config.RedirectURL = fmt.Sprintf("%s/platforms/x/callback", os.Getenv("FRONTEND_URL"))

	// Twitter OAuth 2.0 requires PKCE
	return config.AuthCodeURL(state,
		oauth2.SetAuthURLParam("code_challenge", generateCodeChallenge()),
		oauth2.SetAuthURLParam("code_challenge_method", "plain"),
	)
}

// generateCodeChallenge generates a simple code challenge for PKCE
func generateCodeChallenge() string {
	// In production, generate a proper random challenge and store verifier
	return base64.RawURLEncoding.EncodeToString([]byte("twitter_pkce_challenge_verifier"))
}

// Authenticate implements Platform interface
func (t *TwitterService) Authenticate(code string, userID int) error {
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
	twitterUserID, username, err := t.getUserProfile(token.AccessToken)
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
	_, err = t.db.Exec(query, userID, "twitter", token.AccessToken, token.RefreshToken, twitterUserID, "connected", "@"+username)
	return err
}

// getUserProfile retrieves the user's Twitter profile
func (t *TwitterService) getUserProfile(accessToken string) (string, string, error) {
	req, err := http.NewRequest("GET", "https://api.twitter.com/2/users/me", nil)
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
		Data struct {
			ID       string `json:"id"`
			Username string `json:"username"`
			Name     string `json:"name"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&profile); err != nil {
		return "", "", err
	}

	return profile.Data.ID, profile.Data.Username, nil
}

// Upload implements Platform interface - uploads video to Twitter/X
func (t *TwitterService) Upload(video *models.Video, accountID int) (string, error) {
	var accessToken, twitterUserID string
	err := t.db.QueryRow(
		"SELECT access_token, platform_user_id FROM platform_accounts WHERE id = $1", accountID,
	).Scan(&accessToken, &twitterUserID)
	if err != nil {
		return "", fmt.Errorf("account not found: %w", err)
	}

	// Step 1: Initialize media upload
	mediaID, err := t.uploadMedia(accessToken, video.S3URL)
	if err != nil {
		return "", fmt.Errorf("media upload failed: %w", err)
	}

	// Step 2: Create tweet with media
	tweetURL := "https://api.twitter.com/2/tweets"
	tweetBody := map[string]interface{}{
		"text": fmt.Sprintf("%s\n\n%s", video.Title, video.Description),
		"media": map[string]interface{}{
			"media_ids": []string{mediaID},
		},
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
func (t *TwitterService) uploadMedia(accessToken, videoURL string) (string, error) {
	// Download video
	videoResp, err := http.Get(videoURL)
	if err != nil {
		return "", err
	}
	defer videoResp.Body.Close()

	videoData, err := io.ReadAll(videoResp.Body)
	if err != nil {
		return "", err
	}

	client := &http.Client{}
	mediaUploadURL := "https://upload.twitter.com/1.1/media/upload.json"

	// INIT
	initData := url.Values{}
	initData.Set("command", "INIT")
	initData.Set("media_type", "video/mp4")
	initData.Set("total_bytes", fmt.Sprintf("%d", len(videoData)))
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
	for i := 0; i < len(videoData); i += chunkSize {
		end := i + chunkSize
		if end > len(videoData) {
			end = len(videoData)
		}

		chunk := videoData[i:end]
		appendData := url.Values{}
		appendData.Set("command", "APPEND")
		appendData.Set("media_id", mediaID)
		appendData.Set("segment_index", fmt.Sprintf("%d", i/chunkSize))
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
	var accessToken string
	err := t.db.QueryRow(
		"SELECT access_token FROM platform_accounts WHERE id = $1", accountID,
	).Scan(&accessToken)
	if err != nil {
		return nil, fmt.Errorf("account not found: %w", err)
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
