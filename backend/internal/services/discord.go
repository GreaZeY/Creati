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
			RedirectURL:  os.Getenv("DISCORD_REDIRECT_URL"),
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
	return d.oauthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
}

// Authenticate implements Platform interface
func (d *DiscordService) Authenticate(code string, userID int) error {
	token, err := d.oauthConfig.Exchange(context.Background(), code)
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

	profileName := user.Username
	if user.Discriminator != "" && user.Discriminator != "0" {
		profileName = fmt.Sprintf("%s#%s", user.Username, user.Discriminator)
	}

	// Store tokens in database
	query := `
		INSERT INTO platform_accounts (user_id, platform, access_token, refresh_token, status, profile_name, email, webhook_url, platform_user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (user_id, platform) 
		DO UPDATE SET access_token = $3, refresh_token = $4, status = $5, profile_name = $6, email = $7, webhook_url = $8, platform_user_id = $9, connected_at = NOW()
	`
	_, err = d.db.Exec(query, userID, "discord", token.AccessToken, token.RefreshToken, "connected", profileName, user.Email, webhookURL, user.ID)
	return err
}

// Upload implements Platform interface - sends video to Discord via Webhook
func (d *DiscordService) Upload(video *models.Video) (string, error) {
	var webhookURL string
	err := d.db.QueryRow(
		"SELECT webhook_url FROM platform_accounts WHERE user_id = $1 AND platform = 'discord'",
		video.UserID,
	).Scan(&webhookURL)
	if err != nil || webhookURL == "" {
		return "", fmt.Errorf("no discord webhook found for user: %w", err)
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

// FetchAnalytics implements Platform interface - retrieves reactions
func (d *DiscordService) FetchAnalytics(platformVideoID string) (*Analytics, error) {
	// Discord webhooks don't easily allow fetching reactions back unless we have a bot token
	// or use the webhook URL with /messages/ID? wait=true but identifying which message is hard
	// without storing guild/channel.
	// For now, returning empty analytics as Discord is mainly for distribution.
	return &Analytics{}, nil
}
