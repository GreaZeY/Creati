package services

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"

	"creati.in/creati/backend/internal/db/models"
	"golang.org/x/oauth2"

	"creati.in/creati/backend/internal/utils"

	"creati.in/creati/backend/internal/db/repositories"
)

/**
 * DiscordService implements the Platform interface
 * Handles authentication and distribution via Webhooks
 */
type DiscordService struct {
	db          *sql.DB
	oauthConfig *oauth2.Config
	repo        *repositories.PlatformRepository
}

type discordUser struct {
	ID            string `json:"id"`
	Username      string `json:"username"`
	GlobalName    string `json:"global_name"` // Display name
	Avatar        string `json:"avatar"`
	Discriminator string `json:"discriminator"`
	Email         string `json:"email"`
}

type discordWebhook struct {
	URL       string `json:"url"`
	ID        string `json:"id"`
	Token     string `json:"token"`
	ChannelID string `json:"channel_id"`
	GuildID   string `json:"guild_id"`
}

// NewDiscordService creates a new Discord service instance
func NewDiscordService(db *sql.DB) *DiscordService {
	return &DiscordService{
		db:   db,
		repo: repositories.NewPlatformRepository(db),
		oauthConfig: &oauth2.Config{
			ClientID:     os.Getenv("DISCORD_CLIENT_ID"),
			ClientSecret: os.Getenv("DISCORD_CLIENT_SECRET"),
			Scopes: []string{
				"identify",
				"email",
				"webhook.incoming",
			},
			Endpoint: oauth2.Endpoint{
				AuthURL:  "https://discord.com/api/oauth2/authorize",
				TokenURL: "https://discord.com/api/oauth2/token",
			},
		},
	}
}

// GetAuthURL returns the OAuth URL for user authorization
func (d *DiscordService) GetAuthURL(state string) string {
	return d.GetAuthURLWithHint(state, "", "")
}

// GetAuthURLWithHint returns OAuth URL with optional hint/prompt
func (d *DiscordService) GetAuthURLWithHint(state, prompt, loginHint string) string {
	config := *d.oauthConfig
	config.RedirectURL = fmt.Sprintf("%s/platforms/discord/callback", os.Getenv("FRONTEND_URL"))

	opts := []oauth2.AuthCodeOption{oauth2.AccessTypeOffline}
	if prompt != "" {
		opts = append(opts, oauth2.SetAuthURLParam("prompt", prompt))
	}
	return config.AuthCodeURL(state, opts...)
}

// Authenticate implements Platform interface
func (d *DiscordService) Authenticate(code string, userID int, clientID *int) error {
	config := *d.oauthConfig
	config.RedirectURL = fmt.Sprintf("%s/platforms/discord/callback", os.Getenv("FRONTEND_URL"))

	token, err := config.Exchange(context.Background(), code)
	if err != nil {
		return fmt.Errorf("oauth exchange failed: %w", err)
	}

	// Fetch user info
	client := d.oauthConfig.Client(context.Background(), token)
	resp, err := client.Get("https://discord.com/api/users/@me")
	if err != nil {
		return fmt.Errorf("failed to get user info: %w", err)
	}
	defer resp.Body.Close()

	var user discordUser
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return fmt.Errorf("failed to decode user info: %w", err)
	}

	// Extract webhook info if present in token response
	webhookData, ok := token.Extra("webhook").(map[string]interface{})
	webhookURL := ""
	if ok {
		webhookURL, _ = webhookData["url"].(string)
	}

	profileName := user.GlobalName
	if profileName == "" {
		profileName = user.Username
		if user.Discriminator != "" && user.Discriminator != "0" {
			profileName = fmt.Sprintf("%s#%s", user.Username, user.Discriminator)
		}
	}
	handle := user.Username

	// Encrypt tokens before storing
	encAccess, err := utils.Encrypt(token.AccessToken)
	if err != nil {
		return fmt.Errorf("failed to encrypt access token: %w", err)
	}
	encRefresh, err := utils.Encrypt(token.RefreshToken)
	if err != nil {
		return fmt.Errorf("failed to encrypt refresh token: %w", err)
	}

	// Construct Discord Avatar URL
	profilePic := ""
	if user.Avatar != "" {
		profilePic = fmt.Sprintf("https://cdn.discordapp.com/avatars/%s/%s.png", user.ID, user.Avatar)
	}

	// Use Repository to persist account
	account := &models.PlatformAccount{
		UserID:         userID,
		ClientID:       clientID,
		Platform:       "discord",
		AccessToken:    encAccess,
		RefreshToken:   encRefresh,
		PlatformUserID: user.ID,
		Status:         "connected",
		ProfileName:    profileName,
		Handle:         handle,
		ProfilePicture: profilePic,
		Email:          user.Email,
		WebhookURL:     webhookURL,
	}

	return d.repo.UpsertAccount(context.Background(), account)
}

// Upload implements Platform interface - sends video to Discord via Webhook
func (d *DiscordService) Upload(video *models.Video, accountID int) (string, error) {
	var webhookURL string
	err := d.db.QueryRow(
		"SELECT webhook_url FROM platform_accounts WHERE id = $1", accountID,
	).Scan(&webhookURL)
	if err != nil || webhookURL == "" {
		return "", fmt.Errorf("account not found or no webhook: %w", err)
	}

	// If no media, send text-only message
	if video.StorageURL == "" {
		payload := map[string]interface{}{
			"content": fmt.Sprintf("**%s**\n%s", video.Title, video.Description),
		}
		payloadJSON, _ := json.Marshal(payload)

		resp, err := http.Post(webhookURL, "application/json", bytes.NewBuffer(payloadJSON))
		if err != nil {
			return "", fmt.Errorf("failed to send text-only message to discord: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 400 {
			respBody, _ := io.ReadAll(resp.Body)
			return "", fmt.Errorf("discord webhook error (%d): %s", resp.StatusCode, string(respBody))
		}

		var result struct {
			ID string `json:"id"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&result)
		return result.ID, nil
	}

	// Download video to temp file for reliable upload
	tmpFile, err := utils.DownloadToTempFile(video.StorageURL)
	if err != nil {
		return "", fmt.Errorf("failed to download video to temp file: %w", err)
	}
	defer func() {
		tmpFile.Close()
		os.Remove(tmpFile.Name())
	}()

	// Prepare multipart message
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add JSON payload
	payload := map[string]interface{}{
		"content": fmt.Sprintf("**%s**\n%s", video.Title, video.Description),
	}
	payloadJSON, _ := json.Marshal(payload)
	_ = writer.WriteField("payload_json", string(payloadJSON))

	// Add file
	part, err := writer.CreateFormFile("file", "video.mp4")
	if err != nil {
		return "", fmt.Errorf("failed to create form file: %w", err)
	}
	_, err = io.Copy(part, tmpFile)
	if err != nil {
		return "", fmt.Errorf("failed to copy video content: %w", err)
	}
	_ = writer.Close()

	// Send to Discord Webhook
	req, err := http.NewRequest("POST", webhookURL, body)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	webhookResp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send to discord webhook: %w", err)
	}
	defer webhookResp.Body.Close()

	if webhookResp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(webhookResp.Body)
		return "", fmt.Errorf("discord webhook error (%d): %s", webhookResp.StatusCode, string(respBody))
	}

	// For Discord, we might want to store the message ID if returned
	var result struct {
		ID string `json:"id"`
	}
	_ = json.NewDecoder(webhookResp.Body).Decode(&result)

	return result.ID, nil
}

// GetStatus implements Platform interface
func (d *DiscordService) GetStatus(platformVideoID string) (string, error) {
	return "completed", nil // Webhook sends immediately
}

// FetchAnalytics implements Platform interface
func (d *DiscordService) FetchAnalytics(platformVideoID string, accountID int) (*Analytics, error) {
	// or use the webhook URL with /messages/ID? wait=true but identifying which message is hard
	// without storing guild/channel.
	// For now, returning empty analytics as Discord is mainly for distribution.
	return &Analytics{}, nil
}

// FetchRecentVideos retrieves past videos (not supported for Discord source discovery)
func (d *DiscordService) FetchRecentVideos(accountID int) ([]ExternalVideo, error) {
	// Discord is primarily a target platform via webhooks.
	// Source discovery is not supported as webhooks are write-only.
	return nil, fmt.Errorf("discord can currently only be used as a target platform, not a source")
}

// GetStream implements Platform interface
func (d *DiscordService) GetStream(ctx context.Context, platformVideoID string) (io.ReadCloser, string, error) {
	return nil, "", fmt.Errorf("GetStream not implemented for Discord")
}

// Notify implements Platform interface - sends audience notification to Discord
func (d *DiscordService) Notify(ctx context.Context, target models.UnifiedTarget, content models.Video) error {
	botToken := os.Getenv("DISCORD_BOT_TOKEN")
	if botToken == "" {
		return fmt.Errorf("DISCORD_BOT_TOKEN not configured")
	}

	// Render content
	message := utils.RenderNotificationTemplate(target.CaptionTemplate, content, "YouTube")
	if target.TitleTemplate != "" {
		message = "**" + target.TitleTemplate + "**\n\n" + message
	}

	// Prepare payload
	payload := map[string]interface{}{
		"content": message,
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("json marshal error: %w", err)
	}

	// Send to Discord channel
	url := fmt.Sprintf("https://discord.com/api/v10/channels/%s/messages", target.TargetIdentifier)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return fmt.Errorf("request creation error: %w", err)
	}

	req.Header.Set("Authorization", "Bot "+botToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("http call failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("discord api error (%d): %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}
