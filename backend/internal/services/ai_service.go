package services

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/sashabaranov/go-openai"
)

type AIService struct {
	client *openai.Client
}

func NewAIService() *AIService {
	apiKey := os.Getenv("OPENAI_API_KEY")
	client := openai.NewClient(apiKey)
	return &AIService{
		client: client,
	}
}

// GenerateCreative variations for the Creative Lab
func (s *AIService) GenerateCreative(ctx context.Context, prompt, brandVoice, targetAudience, constraints string) (string, error) {
	systemPrompt := `You are an expert social media copywriter and brand strategist.`

	if brandVoice != "" {
		systemPrompt += fmt.Sprintf("\n\nBRAND VOICE:\n%s", brandVoice)
	}
	if targetAudience != "" {
		systemPrompt += fmt.Sprintf("\n\nTARGET AUDIENCE:\n%s", targetAudience)
	}
	if constraints != "" {
		systemPrompt += fmt.Sprintf("\n\nCONSTRAINTS & AVOID KEYWORDS:\n%s", constraints)
	}

	systemPrompt += "\n\nProvide 3 distinct, highly engaging variations separated by '---'."

	resp, err := s.client.CreateChatCompletion(
		ctx,
		openai.ChatCompletionRequest{
			Model: openai.GPT4oMini,
			Messages: []openai.ChatCompletionMessage{
				{
					Role:    openai.ChatMessageRoleSystem,
					Content: systemPrompt,
				},
				{
					Role:    openai.ChatMessageRoleUser,
					Content: prompt,
				},
			},
			Temperature: 0.7,
		},
	)

	if err != nil {
		return "", fmt.Errorf("OpenAI error: %v", err)
	}

	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("no response from OpenAI")
	}

	return strings.TrimSpace(resp.Choices[0].Message.Content), nil
}

// GenerateMetadata generates SEO-optimized title, description, and tags for a video
func (s *AIService) GenerateMetadata(ctx context.Context, baseDescription, brandVoice, targetAudience, platform string) (string, error) {
	systemPrompt := fmt.Sprintf(`You are an expert social media manager optimizing content metadata for %s.`, platform)

	if brandVoice != "" {
		systemPrompt += fmt.Sprintf("\n\nBRAND VOICE:\n%s", brandVoice)
	}
	if targetAudience != "" {
		systemPrompt += fmt.Sprintf("\n\nTARGET AUDIENCE:\n%s", targetAudience)
	}

	systemPrompt += `

Generate an SEO-optimized Title, Description, and Comma-separated Tags based on the provided context.
Format the output EXACTLY as follows:

TITLE: [Your Title Here]
DESCRIPTION: [Your Description Here]
TAGS: [tag1, tag2, tag3]
`

	resp, err := s.client.CreateChatCompletion(
		ctx,
		openai.ChatCompletionRequest{
			Model: openai.GPT4oMini,
			Messages: []openai.ChatCompletionMessage{
				{
					Role:    openai.ChatMessageRoleSystem,
					Content: systemPrompt,
				},
				{
					Role:    openai.ChatMessageRoleUser,
					Content: baseDescription,
				},
			},
			Temperature: 0.6,
		},
	)

	if err != nil {
		return "", fmt.Errorf("OpenAI error: %v", err)
	}

	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("no response from OpenAI")
	}

	return strings.TrimSpace(resp.Choices[0].Message.Content), nil
}
