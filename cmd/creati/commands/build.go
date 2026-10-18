package commands

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/spf13/cobra"
)

var buildCmd = &cobra.Command{
	Use:   "build",
	Short: "Build production artifacts",
	Long:  `Builds frontend and backend for production deployment`,
	RunE:  runBuild,
}

func init() {
	rootCmd.AddCommand(buildCmd)
}

func runBuild(cmd *cobra.Command, args []string) error {
	cfg := GetConfig()

	UIInfo("Building frontend...")
	frontendBuild := shellCommand(cfg.ProdConfig.FrontendCommand, cfg.FrontendPath)
	frontendBuild.Stdout = os.Stdout
	frontendBuild.Stderr = os.Stderr

	if err := frontendBuild.Run(); err != nil {
		return fmt.Errorf("frontend build failed: %w", err)
	}

	UISuccess("Frontend built to %s", cfg.ProdConfig.FrontendDist)

	UIInfo("Building backend...")
	outputPath, err := filepath.Abs(executableName(cfg.ProdConfig.BackendBin))
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return err
	}
	backendBuild := exec.Command("go", "build", "-o", outputPath, "./cmd/app")
	backendBuild.Dir = cfg.BackendPath
	backendBuild.Stdout = os.Stdout
	backendBuild.Stderr = os.Stderr

	if err := backendBuild.Run(); err != nil {
		return fmt.Errorf("backend build failed: %w", err)
	}

	UISuccess("Backend built to %s", outputPath)
	UISuccess("Build complete!")
	return nil
}
