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

	"example.com/creati/backend/internal/db/models"
	"golang.org/x/oauth2"

	"example.com/creati/backend/internal/utils"
)

/**
 * DiscordService implements the Platform interface
 * Handles authentication and distribution via Webhooks
 */
type DiscordService struct {
	db          *sql.DB
	oauthConfig *oauth2.Config
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
		db: db,
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
func (d *DiscordService) Authenticate(code string, userID int) error {
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
	// The webhook info is actually in the token response extra fields when scope 'webhook.incoming' is used
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

	// Store tokens in database
	query := `
		INSERT INTO platform_accounts (user_id, platform, access_token, refresh_token, status, profile_name, email, webhook_url, platform_user_id, handle)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (user_id, platform, platform_user_id) 
		DO UPDATE SET access_token = $3, refresh_token = $4, status = $5, profile_name = $6, email = $7, webhook_url = $8, handle = $10, connected_at = NOW()
	`
	_, err = d.db.Exec(query, userID, "discord", encAccess, encRefresh, "connected", profileName, user.Email, webhookURL, user.ID, handle)
	return err
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

	// Download video from S3
	resp, err := http.Get(video.S3URL)
	if err != nil {
		return "", fmt.Errorf("failed to download video from S3: %w", err)
	}
	defer resp.Body.Close()

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
	_, err = io.Copy(part, resp.Body)
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

// FetchRecentVideos retrieves past videos (not yet implemented for Discord)
func (d *DiscordService) FetchRecentVideos(accountID int) ([]ExternalVideo, error) {
	return nil, fmt.Errorf("archive blast not supported for discord yet")
}
