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

var forceClear bool

var logsClearCmd = &cobra.Command{
	Use:   "clear",
	Short: "Clear all log files",
	Run:   runLogsClear,
}

func init() {
	logsClearCmd.Flags().BoolVarP(&forceClear, "force", "f", false, "Force clear by truncating files if they are in use")
	logsCmd.AddCommand(logsClearCmd)
	rootCmd.AddCommand(logsCmd)
}

func runLogsClear(cmd *cobra.Command, args []string) {
	logsDir := "backend/logs"

	// Remove all log files
	files, err := filepath.Glob(filepath.Join(logsDir, "*.log"))
	if err != nil {
		fmt.Println("❌ Failed to find log files:", err)
		return
	}

	cleared := 0
	for _, file := range files {
		err := os.Remove(file)
		if err == nil {
			cleared++
			continue
		}

		if forceClear {
			// Try truncation if remove fails and force is enabled
			err := os.Truncate(file, 0)
			if err == nil {
				fmt.Printf("🧹 Truncated locked file: %s\n", file)
				cleared++
			} else {
				fmt.Printf("❌ Failed to clear %s (even with force): %v\n", file, err)
			}
		} else {
			fmt.Printf("⚠️  Failed to remove %s: %v (Use --force to truncate instead)\n", file, err)
		}
	}

	fmt.Printf("✅ Cleared %d log file(s)\n", cleared)
}
