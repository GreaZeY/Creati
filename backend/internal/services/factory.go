package services

import (
	"database/sql"
	"fmt"
)

/**
 * Factory pattern for platform creation
 * Following Open/Closed Principle:
 * - Open for extension: Add new platforms by adding new cases
 * - Closed for modification: Core logic remains unchanged
 */

// GetPlatformService returns the appropriate platform service
func GetPlatformService(platform string, db *sql.DB) (Platform, error) {
	switch platform {
	case "youtube":
		return NewYouTubeService(db), nil
	case "instagram":
		return NewInstagramService(db), nil
	case "facebook":
		return NewFacebookService(db), nil
	case "linkedin":
		return NewLinkedInService(db), nil
	case "x":
		return NewTwitterService(db), nil
	case "discord":
		return NewDiscordService(db), nil
	case "reddit":
		return NewRedditService(db), nil
	// Future platforms
	// case "tiktok":
	//     return NewTikTokService(db), nil
	default:
		return nil, fmt.Errorf("unsupported platform: %s", platform)
	}
}

// GetSupportedPlatforms returns list of currently supported platforms
func GetSupportedPlatforms() []string {
	return []string{"youtube", "instagram", "facebook", "linkedin", "twitter", "discord", "reddit"}
}
