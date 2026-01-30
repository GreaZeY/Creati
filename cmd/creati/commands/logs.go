package commands

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
)

var logsCmd = &cobra.Command{
	Use:   "logs",
	Short: "Manage log files",
	Long:  `Manage application log files`,
}

var logsClearCmd = &cobra.Command{
	Use:   "clear",
	Short: "Clear all log files",
	Run:   runLogsClear,
}

func init() {
	logsCmd.AddCommand(logsClearCmd)
}

func runLogsClear(cmd *cobra.Command, args []string) {
	logsDir := "backend/logs"

	// Remove all log files
	files, err := filepath.Glob(filepath.Join(logsDir, "*.log"))
	if err != nil {
		fmt.Println("❌ Failed to find log files:", err)
		return
	}

	removed := 0
	for _, file := range files {
		if err := os.Remove(file); err != nil {
			fmt.Printf("⚠️  Failed to remove %s: %v\n", file, err)
		} else {
			removed++
		}
	}

	fmt.Printf("✅ Cleared %d log file(s)\n", removed)
}
