package services

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

type BrandIdentityService struct {
	db *sql.DB
}

func NewBrandIdentityService(db *sql.DB) *BrandIdentityService {
	return &BrandIdentityService{db: db}
}

type BrandIdentity struct {
	BrandVoice     string `json:"brandVoice"`
	TargetAudience string `json:"targetAudience"`
	AvoidKeywords  string `json:"avoidKeywords"`
}

func (s *BrandIdentityService) GetIdentity(ctx context.Context, clientID int) (*BrandIdentity, error) {
	var identity BrandIdentity
	err := s.db.QueryRowContext(ctx, `
		SELECT COALESCE(brand_voice, ''), COALESCE(target_audience, ''), COALESCE(avoid_keywords, '')
		FROM clients WHERE id = $1
	`, clientID).Scan(&identity.BrandVoice, &identity.TargetAudience, &identity.AvoidKeywords)

	if err != nil {
		return nil, err
	}
	return &identity, nil
}

func (s *BrandIdentityService) UpdateIdentity(ctx context.Context, clientID int, identity BrandIdentity) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE clients 
		SET brand_voice = $1, target_audience = $2, avoid_keywords = $3
		WHERE id = $4
	`, identity.BrandVoice, identity.TargetAudience, identity.AvoidKeywords, clientID)
	return err
}

func (s *BrandIdentityService) GenerateFromURL(ctx context.Context, url string) (*BrandIdentity, error) {
	// 1. Scrape the URL
	siteData, err := s.scrapeWebsite(url)
	if err != nil {
		return nil, fmt.Errorf("failed to scrape website: %w", err)
	}

	// 2. Multi-stage Extraction (Mocking AI logic for now)
	// In a real implementation, this would send siteData to Gemini/OpenAI
	// to extract the persona.

	// Better Mocking: Extracting hints from siteData
	voice := "Professional and authoritative"
	if strings.Contains(strings.ToLower(siteData), "exciting") || strings.Contains(strings.ToLower(siteData), "new") {
		voice = "Energetic and trend-focused"
	}

	audience := "Decision makers and industry professionals"
	if strings.Contains(strings.ToLower(siteData), "community") || strings.Contains(strings.ToLower(siteData), "everyone") {
		audience = "Broad consumer audience interested in innovation"
	}

	return &BrandIdentity{
		BrandVoice:     fmt.Sprintf("%s. Focusing on clarity and value proposition derived from: %s", voice, s.extractTitle(siteData)),
		TargetAudience: audience,
		AvoidKeywords:  "cheap, discount, low-quality, urgent",
	}, nil
}

func (s *BrandIdentityService) scrapeWebsite(url string) (string, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("failed to fetch website: status %d", resp.StatusCode)
	}

	// Read first 50KB to get meta tags and title
	limitReader := io.LimitReader(resp.Body, 50*1024)
	body, err := io.ReadAll(limitReader)
	if err != nil {
		return "", err
	}

	return string(body), nil
}

func (s *BrandIdentityService) extractTitle(html string) string {
	re := regexp.MustCompile(`(?i)<title>(.*?)</title>`)
	match := re.FindStringSubmatch(html)
	if len(match) > 1 {
		return match[1]
	}
	return "Extracted Site"
}
