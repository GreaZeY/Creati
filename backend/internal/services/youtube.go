package services

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	url "net/url"
	"os"
	"time"

	"example.com/creati/backend/internal/db/models"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	v2 "google.golang.org/api/oauth2/v2"
	"google.golang.org/api/option"
	"google.golang.org/api/youtube/v3"

	"example.com/creati/backend/internal/utils"
)

/**
 * YouTubeService implements the Platform interface
 * Following Single Responsibility: ONLY handles YouTube-specific logic
 */
type YouTubeService struct {
	db          *sql.DB
	oauthConfig *oauth2.Config
}

// NewYouTubeService creates a new YouTube service instance
func NewYouTubeService(db *sql.DB) *YouTubeService {
	return &YouTubeService{
		db: db,
		oauthConfig: &oauth2.Config{
			ClientID:     os.Getenv("YOUTUBE_CLIENT_ID"),
			ClientSecret: os.Getenv("YOUTUBE_CLIENT_SECRET"),
			Scopes: []string{
				youtube.YoutubeUploadScope,
				youtube.YoutubeReadonlyScope,
				"https://www.googleapis.com/auth/userinfo.email",
			},
			Endpoint: google.Endpoint,
		},
	}
}

// GetAuthURL returns the OAuth URL for user authorization
func (y *YouTubeService) GetAuthURL(state string) string {
	config := *y.oauthConfig
	config.RedirectURL = fmt.Sprintf("%s/platforms/youtube/callback", os.Getenv("FRONTEND_URL"))
	return config.AuthCodeURL(state, oauth2.AccessTypeOffline, oauth2.ApprovalForce)
}

// GetAuthURLWithHint returns the OAuth URL with login_hint to skip account picker
func (y *YouTubeService) GetAuthURLWithHint(state, prompt, loginHint string) string {
	config := *y.oauthConfig
	config.RedirectURL = fmt.Sprintf("%s/platforms/youtube/callback", os.Getenv("FRONTEND_URL"))
	opts := []oauth2.AuthCodeOption{
		oauth2.AccessTypeOffline,
		oauth2.ApprovalForce,
	}
	if len(loginHint) > 0 {
		opts = append(opts, oauth2.SetAuthURLParam("login_hint", loginHint))
	}
	// "none" prompt isn't supported for offline access usually, but "select_account" is default.
	// We leave prompt empty to let hint take effect, or force "consent" if needed.
	// If reconnecting, user might just want to approve.
	if len(prompt) > 0 {
		opts = append(opts, oauth2.SetAuthURLParam("prompt", prompt))
	}
	return config.AuthCodeURL(state, opts...)
}

// Authenticate implements Platform interface
// Exchanges OAuth code for tokens and stores them
func (y *YouTubeService) Authenticate(code string, userID int) error {
	config := *y.oauthConfig
	config.RedirectURL = fmt.Sprintf("%s/platforms/youtube/callback", os.Getenv("FRONTEND_URL"))

	// Exchange code for token
	token, err := config.Exchange(context.Background(), code)
	if err != nil {
		return fmt.Errorf("oauth exchange failed: %w", err)
	}

	// Create service to fetch channel details
	ctx := context.Background()
	client := y.oauthConfig.Client(ctx, token)
	service, err := youtube.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		return fmt.Errorf("failed to create youtube client: %w", err)
	}

	// Get channel info (mine=true)
	call := service.Channels.List([]string{"snippet"}).Mine(true)
	conn, err := call.Do()
	if err != nil {
		return fmt.Errorf("failed to fetch channel info: %w", err)
	}

	channelName := "Unknown Channel"
	channelID := ""
	handle := ""
	if len(conn.Items) > 0 {
		channelName = conn.Items[0].Snippet.Title
		channelID = conn.Items[0].Id
		handle = conn.Items[0].Snippet.CustomUrl
	}

	if channelID == "" {
		return fmt.Errorf("failed to retrieve youtube channel id")
	}

	// Get user email
	oauth2Service, err := v2.NewService(ctx, option.WithHTTPClient(client))
	var userEmail string
	if err == nil {
		userInfo, err := oauth2Service.Userinfo.Get().Do()
		if err == nil {
			userEmail = userInfo.Email
		}
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

	query := `
		INSERT INTO platform_accounts (user_id, platform, access_token, refresh_token, status, profile_name, email, platform_user_id, handle)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (user_id, platform, platform_user_id) 
		DO UPDATE SET access_token = $3, refresh_token = $4, status = $5, profile_name = $6, email = $7, handle = $9, connected_at = NOW()
	`
	_, err = y.db.Exec(query, userID, "youtube", encAccess, encRefresh, "connected", channelName, userEmail, channelID, handle)
	if err != nil {
		return err
	}

	// Trigger real-time monitoring via webhooks
	if subErr := y.SubscribeToChannel(channelID); subErr != nil {
		fmt.Printf("⚠️  Failed to subscribe to YouTube webhooks for %s: %v\n", channelID, subErr)
		// We don't fail the whole connection if only subscription fails,
		// but notify user/log it.
	}

	return nil
}

// Upload implements Platform interface
// Uploads video to YouTube and returns YouTube video ID
func (y *YouTubeService) Upload(video *models.Video, accountID int) (string, error) {
	var encAccess, encRefresh string
	err := y.db.QueryRow(
		"SELECT access_token, refresh_token FROM platform_accounts WHERE id = $1", accountID,
	).Scan(&encAccess, &encRefresh)
	if err != nil {
		return "", fmt.Errorf("account not found: %w", err)
	}

	// Decrypt tokens
	accessToken, err := utils.Decrypt(encAccess)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt access token: %w", err)
	}
	refreshToken, err := utils.Decrypt(encRefresh)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt refresh token: %w", err)
	}

	// Create OAuth2 token
	token := &oauth2.Token{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}

	// Create YouTube client
	ctx := context.Background()
	client := y.oauthConfig.Client(ctx, token)
	service, err := youtube.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		return "", fmt.Errorf("failed to create youtube service: %w", err)
	}

	// Create upload request
	upload := &youtube.Video{
		Snippet: &youtube.VideoSnippet{
			Title:       video.Title,
			Description: video.Description,
		},
		Status: &youtube.VideoStatus{
			PrivacyStatus: "private", // Default to private
		},
	}

	// Download video from S3 (simplified - in production use streaming)
	resp, err := http.Get(video.S3URL)
	if err != nil {
		return "", fmt.Errorf("failed to download video: %w", err)
	}
	defer resp.Body.Close()

	// Upload to YouTube
	call := service.Videos.Insert([]string{"snippet", "status"}, upload)
	result, err := call.Media(resp.Body).Do()
	if err != nil {
		return "", fmt.Errorf("youtube upload failed: %w", err)
	}

	return result.Id, nil
}

// GetStatus implements Platform interface
func (y *YouTubeService) GetStatus(platformVideoID string) (string, error) {
	// For YouTube, status is typically available immediately after upload
	// In production, you might check processing status
	return "completed", nil
}

// FetchAnalytics implements Platform interface
func (y *YouTubeService) FetchAnalytics(platformVideoID string, accountID int) (*Analytics, error) {
	var encAccess, encRefresh string
	err := y.db.QueryRow(
		"SELECT access_token, refresh_token FROM platform_accounts WHERE id = $1", accountID,
	).Scan(&encAccess, &encRefresh)
	if err != nil {
		return nil, fmt.Errorf("account not found: %w", err)
	}

	accessToken, err := utils.Decrypt(encAccess)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt access token: %w", err)
	}
	refreshToken, err := utils.Decrypt(encRefresh)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt refresh token: %w", err)
	}

	token := &oauth2.Token{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}

	ctx := context.Background()
	client := y.oauthConfig.Client(ctx, token)
	service, err := youtube.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		return nil, fmt.Errorf("failed to create youtube service: %w", err)
	}

	call := service.Videos.List([]string{"statistics"}).Id(platformVideoID)
	response, err := call.Do()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch youtube statistics: %w", err)
	}

	if len(response.Items) == 0 {
		return nil, fmt.Errorf("video not found")
	}

	stats := response.Items[0].Statistics
	return &Analytics{
		Views:    int64(stats.ViewCount),
		Likes:    int64(stats.LikeCount),
		Comments: int64(stats.CommentCount),
	}, nil
}

// SubscribeToChannel monitors a channel for new uploads using PubSubHubbub
func (y *YouTubeService) SubscribeToChannel(channelID string) error {
	hubURL := "https://pubsubhubbub.appspot.com/subscribe"
	topicURL := fmt.Sprintf("https://www.youtube.com/xml/schemas/2015/feed?channel_id=%s", channelID)

	// Use BACKEND_URL from env for callback
	backendURL := os.Getenv("BACKEND_URL")
	if backendURL == "" {
		backendURL = "http://localhost:8080" // Fallback
	}
	callbackURL := fmt.Sprintf("%s/api/webhooks/youtube", backendURL)

	data := url.Values{}
	data.Set("hub.callback", callbackURL)
	data.Set("hub.topic", topicURL)
	data.Set("hub.verify", "async")
	data.Set("hub.mode", "subscribe")

	fmt.Printf("🚀 Subscribing to YouTube Channel: %s (Callback: %s)\n", channelID, callbackURL)

	resp, err := http.PostForm(hubURL, data)
	if err != nil {
		return fmt.Errorf("failed to post subscription: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted && resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("subscription failed with status: %d", resp.StatusCode)
	}

	return nil
}

// FetchRecentVideos retrieves the most recent uploads from the channel
func (y *YouTubeService) FetchRecentVideos(accountID int) ([]ExternalVideo, error) {
	var encAccess string
	err := y.db.QueryRow("SELECT access_token FROM platform_accounts WHERE id = $1", accountID).Scan(&encAccess)
	if err != nil {
		return nil, fmt.Errorf("account not found: %w", err)
	}

	accessToken, err := utils.Decrypt(encAccess)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt token: %w", err)
	}

	ctx := context.Background()
	token := &oauth2.Token{AccessToken: accessToken}
	client := y.oauthConfig.Client(ctx, token)
	service, err := youtube.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		return nil, err
	}

	// 1. Get the 'uploads' playlist ID for the channel
	channelCall := service.Channels.List([]string{"contentDetails"}).Mine(true)
	channelResp, err := channelCall.Do()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch channel details: %w", err)
	}

	if len(channelResp.Items) == 0 {
		return nil, fmt.Errorf("no channel found")
	}

	uploadsPlaylistID := channelResp.Items[0].ContentDetails.RelatedPlaylists.Uploads

	// 2. Fetch items from the uploads playlist
	playlistCall := service.PlaylistItems.List([]string{"snippet", "contentDetails"}).
		PlaylistId(uploadsPlaylistID).
		MaxResults(50)
	playlistResp, err := playlistCall.Do()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch playlist items: %w", err)
	}

	videos := make([]ExternalVideo, 0, len(playlistResp.Items))
	for _, item := range playlistResp.Items {
		publishedAt, _ := time.Parse(time.RFC3339, item.Snippet.PublishedAt)
		videos = append(videos, ExternalVideo{
			ID:          item.ContentDetails.VideoId,
			Title:       item.Snippet.Title,
			Description: item.Snippet.Description,
			Thumbnail:   item.Snippet.Thumbnails.Default.Url,
			URL:         fmt.Sprintf("https://youtube.com/watch?v=%s", item.ContentDetails.VideoId),
			PublishedAt: publishedAt,
		})
	}

	return videos, nil
}
