package services

import (
	"context"
	"encoding/json"

	"creati.in/creati/backend/internal/db/repositories"
)

// ListAccountsAbility allows the AI to see connected social accounts
type ListAccountsAbility struct {
	Repo *repositories.PlatformRepository
}

func (a *ListAccountsAbility) Name() string { return "list_social_accounts" }
func (a *ListAccountsAbility) Description() string {
	return "Lists all social media accounts connected to current workspace. Use this to find source or target accounts for automations."
}
func (a *ListAccountsAbility) Parameters() any {
	return map[string]interface{}{
		"type":       "object",
		"properties": map[string]interface{}{},
	}
}
func (a *ListAccountsAbility) Execute(ctx context.Context, userID int, args json.RawMessage) (any, error) {
	// For simplicity, we assume personal workspace (clientID = nil) for now,
	// but the agent could eventually ask for a workspace ID.
	accounts, err := a.Repo.ListAccounts(ctx, userID, nil)
	if err != nil {
		return nil, err
	}
	return accounts, nil
}

// GetAnalyticsSummaryAbility provides high-level metrics
type GetAnalyticsSummaryAbility struct {
	Repo *repositories.PlatformRepository // Reusing repo or just direct DB
}

func (a *GetAnalyticsSummaryAbility) Name() string { return "get_analytics_summary" }
func (a *GetAnalyticsSummaryAbility) Description() string {
	return "Provides a summary of total views, likes, and engagement across all platforms for the last 30 days."
}
func (a *GetAnalyticsSummaryAbility) Parameters() any {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"period": map[string]interface{}{
				"type":        "string",
				"description": "Period to analyze (e.g. 7d, 30d, 90d)",
				"default":     "30d",
			},
		},
	}
}
func (a *GetAnalyticsSummaryAbility) Execute(ctx context.Context, userID int, args json.RawMessage) (any, error) {
	// Mock implementation of analytics retrieval
	return map[string]interface{}{
		"total_views":      "125.4K",
		"total_likes":      "8.9K",
		"growth_rate":      "+15%",
		"top_platform":     "YouTube",
		"suggested_action": "Post more YouTube Shorts; they are driving 70% of your new views.",
	}, nil
}
