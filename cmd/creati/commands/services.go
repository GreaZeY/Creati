package commands

import (
	"os"
	"os/exec"
	"strings"

	"github.com/spf13/cobra"
)

var servicesCmd = &cobra.Command{
	Use:   "services",
	Short: "Manage infrastructure services (Docker)",
}

var servicesUpCmd = &cobra.Command{
	Use:   "up",
	Short: "Start all infrastructure services",
	Run: func(cmd *cobra.Command, args []string) {
		StartServices(false)
	},
}

var servicesDownCmd = &cobra.Command{
	Use:   "down",
	Short: "Stop all infrastructure services",
	Run: func(cmd *cobra.Command, args []string) {
		StopServices()
	},
}

func init() {
	servicesCmd.AddCommand(servicesUpCmd)
	servicesCmd.AddCommand(servicesDownCmd)
	rootCmd.AddCommand(servicesCmd)
}

// StartServices brings up the docker-compose stack
func StartServices(checkRunning bool) {
	if checkRunning {
		// Quick check if containers are already up
		out, err := exec.Command("docker-compose", "ps", "--quiet").Output()
		if err == nil && len(strings.TrimSpace(string(out))) > 0 {
			UIInfo("Sidecar services are already running.")
			return
		}
	}

	UIInfo("Starting sidecar services (Docker)...")
	dockerUp := exec.Command("docker-compose", "up", "-d")
	dockerUp.Stdout = os.Stdout
	dockerUp.Stderr = os.Stderr
	if err := dockerUp.Run(); err != nil {
		UIError("Failed to start Docker services. Make sure Docker is running.")
	} else {
		UISuccess("Services are up")
	}
}

// StopServices brings down the docker-compose stack
func StopServices() {
	UIInfo("Stopping sidecar services...")
	dockerDown := exec.Command("docker-compose", "down")
	dockerDown.Stdout = os.Stdout
	dockerDown.Stderr = os.Stderr
	if err := dockerDown.Run(); err != nil {
		UIError("Failed to stop services: %v", err)
	} else {
		UISuccess("Services are stopped")
	}
}
