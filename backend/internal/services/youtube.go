package services

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"net/http"
	url "net/url"
	"os"
	"sort"
	"sync"
	"time"

	"creati.in/creati/backend/internal/db/models"
	"creati.in/creati/backend/internal/db/repositories"
	"creati.in/creati/backend/internal/logger"
	youtube_dl "github.com/kkdai/youtube/v2"
	"github.com/sirupsen/logrus"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	v2 "google.golang.org/api/oauth2/v2"
	"google.golang.org/api/option"
	"google.golang.org/api/youtube/v3"

	"creati.in/creati/backend/internal/utils"
)

/**
 * YouTubeService implements the Platform interface
 * Following Single Responsibility: ONLY handles YouTube-specific logic
 */
type YouTubeService struct {
	db          *sql.DB
	oauthConfig *oauth2.Config
	repo        *repositories.PlatformRepository
}

// NewYouTubeService creates a new YouTube service instance
func NewYouTubeService(db *sql.DB) *YouTubeService {
	return &YouTubeService{
		db:   db,
		repo: repositories.NewPlatformRepository(db),
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

// DBTokenSource wraps oauth2.TokenSource to persist updates to the database
type DBTokenSource struct {
	src       oauth2.TokenSource
	db        *sql.DB
	accountID int
	mu        sync.Mutex
	lastToken *oauth2.Token
}

func (s *DBTokenSource) Token() (*oauth2.Token, error) {
	t, err := s.src.Token()
	if err != nil {
		return nil, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// Check if token has changed (access or refresh) and needs saving
	// We save if it's the first time checking (lastToken == nil) AND it's different from what we thought,
	// OR if it explicitly changed from the last known state.
	// Actually, simpler: if t.AccessToken != s.lastToken.AccessToken, save it.
	if s.lastToken == nil || t.AccessToken != s.lastToken.AccessToken || t.RefreshToken != s.lastToken.RefreshToken {
		// Encrypt tokens
		encAccess, err := utils.Encrypt(t.AccessToken)
		if err != nil {
			fmt.Printf("Failed to encrypt new access token: %v\n", err)
			return t, nil // return token even if save fails, to keep working
		}

		// If refresh token is empty in new token, likely it didn't change (OAuth2 standard),
		// but we should keep the old one in DB.
		// However, query expects a value.
		// If t.RefreshToken is empty, we should use s.lastToken.RefreshToken if available.
		refreshToken := t.RefreshToken
		if refreshToken == "" && s.lastToken != nil {
			refreshToken = s.lastToken.RefreshToken
		}

		encRefresh, err := utils.Encrypt(refreshToken)
		if err != nil {
			fmt.Printf("Failed to encrypt new refresh token: %v\n", err)
			return t, nil
		}

		// Update DB
		// Note: We only update if we have an ID (which we do)
		_, err = s.db.Exec(`
			UPDATE platform_accounts 
			SET access_token = $1, refresh_token = $2, status = 'connected', connected_at = NOW() 
			WHERE id = $3
		`, encAccess, encRefresh, s.accountID)

		if err != nil {
			fmt.Printf("Failed to persist refreshed token: %v\n", err)
		} else {
			fmt.Printf("🔄 Refreshed and saved new YouTube token for account %d\n", s.accountID)
			s.lastToken = t
			// Ensure we keep the valid refresh token in memory if the new one was blank
			if s.lastToken.RefreshToken == "" {
				s.lastToken.RefreshToken = refreshToken
			}
		}
	}

	return t, nil
}

func (y *YouTubeService) getClient(ctx context.Context, accountID int) (*http.Client, error) {
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

	// Initial token
	token := &oauth2.Token{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		Expiry:       time.Now().Add(-1 * time.Minute), // Force check/refresh if needed (Expiry not stored, so assuming expired is safer, or let wrapper handle it?)
		// Actually, if we don't store expiry, we can't be sure.
		// If we set Expiry to past, TokenSource will immediately try to refresh.
		// Setting it to zero time means "never expires" or "unknown", usually triggers refresh if checking.
		// Let's rely on 401? No, oauth2 library checks expiry.
		// If we don't know expiry, best to set it to Now() so it checks.
	}
	// Better: If we persist expiry in DB we'd know. Since we don't, we might cause a refresh on every new client creation
	// which is every request. That's aggressive.
	// But without expiry, we risk 401.
	// Compromise: Set expiry to Now() - 1 sec to force a refresh IF it's actually invalid?
	// No, if the token IS valid, we waste a refresh.
	// API calls with invalid token usually return 401, but the library might auto-refresh then?
	// oauth2.ReuseTokenSource logic: if t.Valid(), use it. Valid() checks expiry.
	// If we don't set expiry, Valid() returns true (if expiry is zero)? No, Valid() returns !expiry.IsZero() && expiry.After(now).
	// So if zero, it's considered valid? No, usually invalid.
	// Actually, failing to set Expiry usually means it's assumed valid eternally or invalid immediately depending on impl.
	// Let's set it to time.Time{} (zero). oauth2 checks: `if t.Expiry.IsZero() { return false }` -> considered invalid?
	// Wait, we want to start with the stored token.
	// If we refresh on every request, we hit rate limits.
	// We really should store expiry.
	// Since we don't, maybe we just assume it's valid for now?
	// Or we just accept the cost for this fix since the user is blocked.
	// Let's set it to valid for 1 minute?
	// If we set it to time.Now(), it's expired.
	// Let's try to fetch user info or something cheap? No.
	// Given we are refactoring to fix a bug where it NEVER refreshed, let's allow it to refresh.
	// BUT, if we save the NEW token, we want `lastToken` to be updated.
	// If we constantly refresh, we constantly write to DB.
	// Solution: Use the `expiry` from the REFRESHED token.
	// But on fresh boot/request, we don't know it.
	// Maybe we just let it refresh once per request context?
	// Ideally we add `expires_at` to DB.
	// For now, I'll set Expiry to Now so it refreshes. It preserves correctness at cost of performance.
	token.Expiry = time.Now().Add(-1 * time.Second)

	ts := y.oauthConfig.TokenSource(ctx, token)

	dbTS := &DBTokenSource{
		src:       ts,
		db:        y.db,
		accountID: accountID,
		lastToken: token,
	}

	return oauth2.NewClient(ctx, dbTS), nil
}
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

	// Use Repository to persist account
	account := &models.PlatformAccount{
		UserID:         userID,
		Platform:       "youtube",
		AccessToken:    encAccess,
		RefreshToken:   encRefresh,
		PlatformUserID: channelID,
		Status:         "connected",
		ProfileName:    channelName,
		Handle:         handle,
		Email:          userEmail,
	}

	err = y.repo.UpsertAccount(context.Background(), account)
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
	// Create YouTube client
	ctx := context.Background()
	client, err := y.getClient(ctx, accountID)
	if err != nil {
		return "", err
	}

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

	// Download video to a temp file for reliable upload
	tmpFile, err := utils.DownloadToTempFile(video.S3URL)
	if err != nil {
		return "", fmt.Errorf("failed to download video to temp file: %w", err)
	}
	defer func() {
		tmpFile.Close()
		os.Remove(tmpFile.Name())
	}()

	// Upload to YouTube
	call := service.Videos.Insert([]string{"snippet", "status"}, upload)
	result, err := call.Media(tmpFile).Do()
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
	ctx := context.Background()
	client, err := y.getClient(ctx, accountID)
	if err != nil {
		return nil, err
	}

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
	ctx := context.Background()
	client, err := y.getClient(ctx, accountID)
	if err != nil {
		return nil, err
	}

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

// GetStream implements Platform interface for YouTube
func (y *YouTubeService) GetStream(ctx context.Context, vidID string) (io.ReadCloser, string, error) {
	client := youtube_dl.Client{}
	video, err := client.GetVideoContext(ctx, vidID)
	if err != nil {
		return nil, "", err
	}

	formats := video.Formats.WithAudioChannels()

	// Prioritize itag 22 (720p combined mp4) if available
	var bestFormat *youtube_dl.Format
	for i := range formats {
		if formats[i].ItagNo == 22 {
			bestFormat = &formats[i]
			break
		}
	}

	if bestFormat == nil {
		// Fallback to highest height mp4
		mp4Formats := formats.Type("video/mp4")
		if len(mp4Formats) > 0 {
			sort.Slice(mp4Formats, func(i, j int) bool { return mp4Formats[i].Height > mp4Formats[j].Height })
			bestFormat = &mp4Formats[0]
		}
	}

	if bestFormat == nil {
		// Absolute fallback to highest height anything
		sort.Slice(formats, func(i, j int) bool { return formats[i].Height > formats[j].Height })
		if len(formats) > 0 {
			bestFormat = &formats[0]
		}
	}

	if bestFormat == nil {
		return nil, "", fmt.Errorf("no suitable audio-video formats found for %s", vidID)
	}

	logger.Get("youtube").WithFields(logrus.Fields{
		"vid":    vidID,
		"itag":   bestFormat.ItagNo,
		"height": bestFormat.Height,
		"type":   bestFormat.MimeType,
	}).Info("Selected highest quality combined stream")

	stream, _, err := client.GetStreamContext(ctx, video, bestFormat)
	if err != nil {
		return nil, "", err
	}

	return stream, "video/mp4", nil
}
