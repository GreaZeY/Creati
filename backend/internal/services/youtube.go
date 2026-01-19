package services

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"os"

	"example.com/creati/backend/internal/db/models"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/option"
	"google.golang.org/api/youtube/v3"
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
			RedirectURL:  os.Getenv("YOUTUBE_REDIRECT_URL"),
			Scopes: []string{
				youtube.YoutubeUploadScope,
				youtube.YoutubeReadonlyScope,
			},
			Endpoint: google.Endpoint,
		},
	}
}

// GetAuthURL returns the OAuth URL for user authorization
func (y *YouTubeService) GetAuthURL(state string) string {
	return y.oauthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
}

// Authenticate implements Platform interface
// Exchanges OAuth code for tokens and stores them
func (y *YouTubeService) Authenticate(code string, userID int) error {
	// Exchange code for token
	token, err := y.oauthConfig.Exchange(context.Background(), code)
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
	if len(conn.Items) > 0 {
		channelName = conn.Items[0].Snippet.Title
	}

	// Store tokens in database using 'connected' status to match list logic
	query := `
		INSERT INTO platform_accounts (user_id, platform, access_token, refresh_token, status, profile_name)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (user_id, platform) 
		DO UPDATE SET access_token = $3, refresh_token = $4, status = $5, profile_name = $6, connected_at = NOW()
	`
	_, err = y.db.Exec(query, userID, "youtube", token.AccessToken, token.RefreshToken, "connected", channelName)
	return err
}

// Upload implements Platform interface
// Uploads video to YouTube and returns YouTube video ID
func (y *YouTubeService) Upload(video *models.Video) (string, error) {
	// Get user's access token
	var accessToken, refreshToken string
	err := y.db.QueryRow(
		"SELECT access_token, refresh_token FROM platform_accounts WHERE user_id = $1 AND platform = $2",
		video.UserID, "youtube",
	).Scan(&accessToken, &refreshToken)
	if err != nil {
		return "", fmt.Errorf("no youtube account connected: %w", err)
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
func (y *YouTubeService) FetchAnalytics(platformVideoID string) (*Analytics, error) {
	// TODO: Implement YouTube Analytics API integration
	// For now, return placeholder
	return &Analytics{
		Views:    0,
		Likes:    0,
		Comments: 0,
	}, nil
}
