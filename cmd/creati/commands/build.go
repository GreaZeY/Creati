package commands

import (
	"fmt"
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

func runBuild(cmd *cobra.Command, args []string) {
	cfg := GetConfig()

	fmt.Println("🔨 Building frontend...")
	frontendBuild := exec.Command("cmd", "/C", "cd "+cfg.FrontendPath+" && npm run build")
	frontendBuild.Stdout = os.Stdout
	frontendBuild.Stderr = os.Stderr

	if err := frontendBuild.Run(); err != nil {
		fmt.Println("❌ Frontend build failed:", err)
		return
	}

	fmt.Println("✅ Frontend built to", cfg.ProdConfig.FrontendDist)

	fmt.Println("\n🔨 Building backend...")
	backendBuild := exec.Command("go", "build", "-o", cfg.ProdConfig.BackendBin, "./backend/cmd/app")
	backendBuild.Stdout = os.Stdout
	backendBuild.Stderr = os.Stderr

	if err := backendBuild.Run(); err != nil {
		fmt.Println("❌ Backend build failed:", err)
		return
	}

	fmt.Println("✅ Backend built to", cfg.ProdConfig.BackendBin)
	fmt.Println("\n🎉 Build complete!")
}
