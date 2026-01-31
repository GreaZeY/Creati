package commands

import (
	"fmt"
	"strings"

	"github.com/fatih/color"
)

var (
	colorError   = color.New(color.FgRed).SprintFunc()
	colorWarning = color.New(color.FgYellow).SprintFunc()
	colorInfo    = color.New(color.FgBlue).SprintFunc()
	colorSuccess = color.New(color.FgGreen).SprintFunc()
	colorMuted   = color.New(color.FgCyan).SprintFunc()
)

// LogLevelColor returns a colored string based on the content of the log line
func LogLevelColor(line string) string {
	lowerLine := strings.ToLower(line)

	if containsAny(lowerLine, "error", "failed", "panic", "fatal", "exception", "❌") {
		return colorError(line)
	}

	if containsAny(lowerLine, "warn", "warning", "⚠️", "deprecated") {
		return colorWarning(line)
	}

	if containsAny(lowerLine, "info", "✓", "✅", "🚀", "started", "connected") {
		return colorInfo(line)
	}

	return line
}

// containsAny returns true if the string contains any of the provided keywords
func containsAny(s string, keywords ...string) bool {
	for _, k := range keywords {
		if strings.Contains(s, k) {
			return true
		}
	}
	return false
}

// UI Helpers for CLI messages

func UIError(msg string, args ...interface{}) {
	fmt.Printf("%s %s\n", colorError("❌ "), colorError(fmt.Sprintf(msg, args...)))
}

func UIWarning(msg string, args ...interface{}) {
	fmt.Printf("%s %s\n", colorWarning("⚠️ "), colorWarning(fmt.Sprintf(msg, args...)))
}

func UIInfo(msg string, args ...interface{}) {
	fmt.Printf("%s %s\n", colorInfo("🔹 "), colorInfo(fmt.Sprintf(msg, args...)))
}

func UISuccess(msg string, args ...interface{}) {
	fmt.Printf("%s %s\n", colorSuccess("✅ "), colorSuccess(fmt.Sprintf(msg, args...)))
}
