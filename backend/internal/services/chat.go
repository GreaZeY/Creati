package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"creati.in/creati/backend/internal/logger"
)

type ChatService struct {
	db       *sql.DB
	registry *AbilityRegistry
}

func NewChatService(db *sql.DB, registry *AbilityRegistry) *ChatService {
	return &ChatService{
		db:       db,
		registry: registry,
	}
}

type Message struct {
	Role      string    `json:"role"`
	Content   string    `json:"content"`
	Timestamp time.Time `json:"timestamp"`
}

// ProcessChat handles the conversation loop
func (s *ChatService) ProcessChat(ctx context.Context, userID int, conversationID *string, userMessage string) (any, error) {
	// 1. Load or initialize conversation
	var cid string
	var history []Message

	if conversationID != nil && *conversationID != "" {
		cid = *conversationID
		var historyRaw []byte
		err := s.db.QueryRowContext(ctx, "SELECT messages FROM ai_conversations WHERE id = $1 AND user_id = $2", cid, userID).Scan(&historyRaw)
		if err != nil {
			return nil, fmt.Errorf("failed to load conversation: %w", err)
		}
		json.Unmarshal(historyRaw, &history)
	} else {
		// New conversation
		err := s.db.QueryRowContext(ctx, "INSERT INTO ai_conversations (user_id, messages) VALUES ($1, '[]'::jsonb) RETURNING id", userID).Scan(&cid)
		if err != nil {
			return nil, fmt.Errorf("failed to create conversation: %w", err)
		}
	}

	// 2. Append user message
	history = append(history, Message{Role: "user", Content: userMessage, Timestamp: time.Now()})

	// 3. Orhcestrate LLM (Stubbed for now, will integrate with OpenAI/Gemini)
	// For the initial build, we respond with a prompt about abilities
	agentResponse := fmt.Sprintf("I am your Creati Agent. I've received your message: '%s'. I'm currently connecting to my tool registry to assist you better.", userMessage)

	// 4. Save history
	history = append(history, Message{Role: "assistant", Content: agentResponse, Timestamp: time.Now()})
	historyJSON, _ := json.Marshal(history)
	s.db.ExecContext(ctx, "UPDATE ai_conversations SET messages = $1, updated_at = NOW() WHERE id = $2", historyJSON, cid)

	return map[string]interface{}{
		"conversationId": cid,
		"message":        agentResponse,
		"history":        history,
	}, nil
}

func (s *ChatService) auditToolExecution(userID int, cid string, toolName string, args json.RawMessage, status string, err error, duration time.Duration) {
	errorMsg := ""
	if err != nil {
		errorMsg = err.Error()
	}

	_, auditErr := s.db.Exec(`
		INSERT INTO ai_agent_audit (user_id, conversation_id, tool_name, arguments, status, error_msg, execution_time_ms)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, userID, cid, toolName, args, status, errorMsg, duration.Milliseconds())

	if auditErr != nil {
		logger.Get("chat").WithError(auditErr).Error("Failed to log tool audit")
	}
}
