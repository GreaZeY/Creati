package services

import (
	"context"
	"encoding/json"
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

// TranscribeVideo converts video audio to text using OpenAI Whisper
func (s *AIService) TranscribeVideo(ctx context.Context, audioFilePath string) (string, error) {
	resp, err := s.client.CreateTranscription(
		ctx,
		openai.AudioRequest{
			Model:    openai.Whisper1,
			FilePath: audioFilePath,
		},
	)
	if err != nil {
		return "", fmt.Errorf("Whisper error: %v", err)
	}
	return resp.Text, nil
}

type ViralSegment struct {
	Start float64 `json:"start"`
	End   float64 `json:"end"`
	Hook  string  `json:"hook"`
	Topic string  `json:"topic"`
}

// AnalyzeViralSegments identifies high-impact moments in a transcript
func (s *AIService) AnalyzeViralSegments(ctx context.Context, transcript string) ([]ViralSegment, error) {
	systemPrompt := `You are an expert viral content strategist. 
Analyze the provided transcript and identify 3-5 high-impact segments (under 60s each) that would make excellent standalone vertical shorts.
For each segment, provide:
- start (approximate start time in seconds, ESTIMATE based on word count/pacing if needed)
- end (approximate end time in seconds)
- hook (a catchy first line or title)
- topic (1-sentence summary)

Response must be a valid JSON array of objects.`

	resp, err := s.client.CreateChatCompletion(
		ctx,
		openai.ChatCompletionRequest{
			Model: openai.GPT4o, // Use GPT-4o for better analysis
			Messages: []openai.ChatCompletionMessage{
				{
					Role:    openai.ChatMessageRoleSystem,
					Content: systemPrompt,
				},
				{
					Role:    openai.ChatMessageRoleUser,
					Content: transcript,
				},
			},
			ResponseFormat: &openai.ChatCompletionResponseFormat{
				Type: openai.ChatCompletionResponseFormatTypeJSONObject,
			},
		},
	)

	if err != nil {
		return nil, fmt.Errorf("segment analysis error: %v", err)
	}

	var result struct {
		Segments []ViralSegment `json:"segments"`
	}
	if err := json.Unmarshal([]byte(resp.Choices[0].Message.Content), &result); err != nil {
		return nil, fmt.Errorf("failed to parse segments: %w", err)
	}

	return result.Segments, nil
}
