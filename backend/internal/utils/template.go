package utils

import (
	"strings"

	"creati.in/creati/backend/internal/db/models"
)

// RenderNotificationTemplate processes template strings with content data
func RenderNotificationTemplate(tmplStr string, content models.Video, platform string) string {
	result := tmplStr
	replacements := map[string]string{
		"{{title}}":       content.Title,
		"{{description}}": content.Description,
		"{{url}}":         content.S3URL, // Ideally this would be the final platform URL if known
		"{{platform}}":    platform,
	}

	for placeholder, value := range replacements {
		result = strings.Replace(result, placeholder, value, -1)
	}

	return result
}
