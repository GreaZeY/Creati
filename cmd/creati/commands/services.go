package commands

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/spf13/cobra"
)

var servicesCmd = &cobra.Command{
	Use:   "services",
	Short: "Manage infrastructure services (Docker)",
}

var servicesUpCmd = &cobra.Command{
	Use:   "up",
	Short: "Start all infrastructure services",
	RunE: func(cmd *cobra.Command, args []string) error {
		return StartServices()
	},
}

var servicesDownCmd = &cobra.Command{
	Use:   "down",
	Short: "Stop all infrastructure services",
	RunE: func(cmd *cobra.Command, args []string) error {
		return StopServices()
	},
}

func init() {
	servicesCmd.AddCommand(servicesUpCmd)
	servicesCmd.AddCommand(servicesDownCmd)
	rootCmd.AddCommand(servicesCmd)
}

func composeCommand(args ...string) *exec.Cmd {
	if exec.Command("docker", "compose", "version").Run() == nil {
		return exec.Command("docker", append([]string{"compose"}, args...)...)
	}
	return exec.Command("docker-compose", args...)
}

// StartServices brings up the Compose stack; up is idempotent and starts missing services.
func StartServices() error {
	UIInfo("Starting sidecar services (Docker)...")
	dockerUp := composeCommand("up", "-d")
	dockerUp.Stdout = os.Stdout
	dockerUp.Stderr = os.Stderr
	if err := dockerUp.Run(); err != nil {
		return fmt.Errorf("start Docker services (check Docker and Compose are installed and running): %w", err)
	}
	UISuccess("Services are up")
	return nil
}

// StopServices brings down the docker-compose stack
func StopServices() error {
	UIInfo("Stopping sidecar services...")
	dockerDown := composeCommand("down")
	dockerDown.Stdout = os.Stdout
	dockerDown.Stderr = os.Stderr
	if err := dockerDown.Run(); err != nil {
		return fmt.Errorf("stop Docker services: %w", err)
	}
	UISuccess("Services are stopped")
	return nil
}
