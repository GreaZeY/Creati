package commands

import (
	"os"
	"os/exec"

	"github.com/spf13/cobra"
)

var devCmd = &cobra.Command{
	Use:   "dev",
	Short: "Smart development startup",
	Long:  `Ensures dependencies are installed and starts development servers`,
	Run:   runDev,
}

func init() {
	rootCmd.AddCommand(devCmd)
}

func runDev(cmd *cobra.Command, args []string) {
	cfg := GetConfig()

	// Check and install backend dependencies
	UIInfo("Checking backend dependencies...")
	backendDeps := exec.Command("go", "mod", "download")
	backendDeps.Dir = cfg.BackendPath
	if err := backendDeps.Run(); err != nil {
		UIWarning("Backend dependencies check failed: %v", err)
	}

	// Check and install frontend dependencies
	UIInfo("Checking frontend dependencies...")
	if _, err := os.Stat(cfg.FrontendPath + "/node_modules"); os.IsNotExist(err) {
		UIInfo("Installing frontend dependencies...")
		frontendInstall := exec.Command("npm", "install")
		frontendInstall.Dir = cfg.FrontendPath
		frontendInstall.Stdout = os.Stdout
		frontendInstall.Stderr = os.Stderr
		if err := frontendInstall.Run(); err != nil {
			UIError("Frontend install failed: %v", err)
			return
		}
	}

	UISuccess("Dependencies ready")

	// Start services
	runStart(cmd, args)
}
