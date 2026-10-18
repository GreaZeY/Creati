package commands

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/spf13/cobra"
)

var devCmd = &cobra.Command{
	Use:   "dev",
	Short: "Smart development startup",
	Long:  `Ensures dependencies are installed and starts development servers`,
	RunE:  runDev,
}

func init() {
	rootCmd.AddCommand(devCmd)
}

func runDev(cmd *cobra.Command, args []string) error {
	cfg := GetConfig()

	// Check and install backend dependencies
	UIInfo("Checking backend dependencies...")
	backendDeps := exec.Command("go", "mod", "download")
	backendDeps.Dir = cfg.BackendPath
	if err := backendDeps.Run(); err != nil {
		return fmt.Errorf("backend dependencies check failed: %w", err)
	}

	// Check and install frontend dependencies
	UIInfo("Checking frontend dependencies...")
	if _, err := os.Stat(filepath.Join(cfg.FrontendPath, "node_modules")); os.IsNotExist(err) {
		UIInfo("Installing frontend dependencies...")
		frontendInstall := shellCommand("npm install", cfg.FrontendPath)
		frontendInstall.Stdout = os.Stdout
		frontendInstall.Stderr = os.Stderr
		if err := frontendInstall.Run(); err != nil {
			return fmt.Errorf("frontend install failed: %w", err)
		}
	}

	UISuccess("Dependencies ready")

	// Start services
	return runStart(cmd, args)
}
