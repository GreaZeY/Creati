package services

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"creati.in/creati/backend/internal/logger"
)

type AlertPhone struct {
	Label string `json:"label"`
	Phone string `json:"phone"`
}

type WhatsAppService struct {
	phoneID       string
	accessToken   string
	webhookSecret string
}

func NewWhatsAppService() *WhatsAppService {
	return &WhatsAppService{
		phoneID:       os.Getenv("WHATSAPP_PHONE_ID"),
		accessToken:   os.Getenv("WHATSAPP_TOKEN"),
		webhookSecret: os.Getenv("WHATSAPP_WEBHOOK_SECRET"),
	}
}

// SendFailureAlert sends an interactive WhatsApp message to recipients
func (s *WhatsAppService) SendFailureAlert(ctx context.Context, phones []AlertPhone, executionID string, platform string, errMsg string) error {
	if s.accessToken == "" || s.phoneID == "" {
		return fmt.Errorf("whatsapp credentials not configured")
	}

	for _, p := range phones {
		if err := s.sendSingleAlert(ctx, p.Phone, executionID, platform, errMsg); err != nil {
			logger.Get("whatsapp").WithError(err).WithField("phone", p.Phone).Error("Failed to send WhatsApp alert")
		}
	}

	return nil
}

func (s *WhatsAppService) sendSingleAlert(ctx context.Context, phone, executionID, platform, errMsg string) error {
	// Generate signed retry token: executionID_HMAC
	token := s.GenerateRetryToken(executionID)

	apiURL := fmt.Sprintf("https://graph.facebook.com/v19.0/%s/messages", s.phoneID)

	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                phone,
		"type":              "interactive",
		"interactive": map[string]interface{}{
			"type": "button",
			"header": map[string]interface{}{
				"type": "text",
				"text": "⚠️ Automation Failure",
			},
			"body": map[string]interface{}{
				"text": fmt.Sprintf("Automation for *%s* failed.\n\nError: %s", platform, errMsg),
			},
			"footer": map[string]interface{}{
				"text": "ID: " + executionID,
			},
			"action": map[string]interface{}{
				"buttons": []interface{}{
					map[string]interface{}{
						"type": "reply",
						"reply": map[string]interface{}{
							"id":    token,
							"title": "Retry Now",
						},
					},
				},
			},
		},
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewBuffer(body))
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+s.accessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errData interface{}
		json.NewDecoder(resp.Body).Decode(&errData)
		return fmt.Errorf("whatsapp api error (%d): %v", resp.StatusCode, errData)
	}

	return nil
}

func (s *WhatsAppService) GenerateRetryToken(executionID string) string {
	h := hmac.New(sha256.New, []byte(s.webhookSecret))
	h.Write([]byte(executionID))
	signature := hex.EncodeToString(h.Sum(nil))
	// Truncate signature to fit in ID limit if needed, 16 chars is usually enough for security here
	return fmt.Sprintf("retry_%s_%s", executionID, signature[:16])
}

func (s *WhatsAppService) VerifyRetryToken(token string) (string, bool) {
	// Format: retry_ID_SIGNATURE
	var id, sig string
	_, err := fmt.Sscanf(token, "retry_%s_%s", &id, &sig) // Sscanf might be tricky with UUIDs
	if err != nil {
		// Fallback split
		parts := bytes.Split([]byte(token), []byte("_"))
		if len(parts) != 3 {
			return "", false
		}
		id = string(parts[1])
		sig = string(parts[2])
	}

	expected := s.GenerateRetryToken(id)
	return id, token == expected
}
