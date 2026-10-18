package commands

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/spf13/cobra"
)

var updateCmd = &cobra.Command{
	Use:   "self-update",
	Short: "Rebuild the creati CLI binary",
	Long:  `Rebuilds the creati binary from source and replaces the current one in the tools directory.`,
	RunE:  runSelfUpdate,
}

func init() {
	rootCmd.AddCommand(updateCmd)
}

func runSelfUpdate(cmd *cobra.Command, args []string) error {
	UIInfo("Rebuilding creati CLI...")

	outputPath := filepath.Join("tools", executableName("creati"))
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return err
	}
	buildCmd := exec.Command("go", "build", "-o", outputPath, "./cmd/creati")
	buildCmd.Stdout = os.Stdout
	buildCmd.Stderr = os.Stderr

	if err := buildCmd.Run(); err != nil {
		return fmt.Errorf("failed to rebuild CLI: %w", err)
	}

	UISuccess("creati CLI rebuilt at %s", outputPath)
	return nil
}
