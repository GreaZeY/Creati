package commands

import (
	"os"
	"os/exec"

	"github.com/spf13/cobra"
)

var buildCmd = &cobra.Command{
	Use:   "build",
	Short: "Build production artifacts",
	Long:  `Builds frontend and backend for production deployment`,
	Run:   runBuild,
}

func init() {
	rootCmd.AddCommand(buildCmd)
}

func runBuild(cmd *cobra.Command, args []string) {
	cfg := GetConfig()

	UIInfo("Building frontend...")
	frontendBuild := exec.Command("cmd", "/C", "cd "+cfg.FrontendPath+" && npm run build")
	frontendBuild.Stdout = os.Stdout
	frontendBuild.Stderr = os.Stderr

	if err := frontendBuild.Run(); err != nil {
		UIError("Frontend build failed: %v", err)
		return
	}

	UISuccess("Frontend built to %s", cfg.ProdConfig.FrontendDist)

	UIInfo("Building backend...")
	backendBuild := exec.Command("go", "build", "-o", cfg.ProdConfig.BackendBin, "./backend/cmd/app")
	backendBuild.Stdout = os.Stdout
	backendBuild.Stderr = os.Stderr

	if err := backendBuild.Run(); err != nil {
		UIError("Backend build failed: %v", err)
		return
	}

	UISuccess("Backend built to %s", cfg.ProdConfig.BackendBin)
	UISuccess("Build complete!")
}
