package commands

import (
	"fmt"
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
	fmt.Println("📦 Checking backend dependencies...")
	backendDeps := exec.Command("go", "mod", "download")
	backendDeps.Dir = cfg.BackendPath
	if err := backendDeps.Run(); err != nil {
		fmt.Println("⚠️  Backend dependencies check failed:", err)
	}

	// Check and install frontend dependencies
	fmt.Println("📦 Checking frontend dependencies...")
	if _, err := os.Stat(cfg.FrontendPath + "/node_modules"); os.IsNotExist(err) {
		fmt.Println("📦 Installing frontend dependencies...")
		frontendInstall := exec.Command("npm", "install")
		frontendInstall.Dir = cfg.FrontendPath
		frontendInstall.Stdout = os.Stdout
		frontendInstall.Stderr = os.Stderr
		if err := frontendInstall.Run(); err != nil {
			fmt.Println("❌ Frontend install failed:", err)
			return
		}
	}

	fmt.Println("✅ Dependencies ready\n")

	// Start services
	runStart(cmd, args)
}
