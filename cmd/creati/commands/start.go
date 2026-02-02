package commands

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/signal"
	"syscall"

	"github.com/fatih/color"
	"github.com/spf13/cobra"
)

var workerOnly bool

var startCmd = &cobra.Command{
	Use:   "start",
	Short: "Start frontend and backend",
	Long:  `Starts both frontend and backend services with prefixed colored logs`,
	Run:   runStart,
}

func init() {
	startCmd.Flags().BoolVarP(&workerOnly, "worker-only", "w", false, "Start only the backend worker")
	rootCmd.AddCommand(startCmd)
}

func runStart(cmd *cobra.Command, args []string) {
	cfg := GetConfig()

	var backendCmd, frontendCmd *exec.Cmd

	if cfg.IsDev() {
		UISuccess("Starting in DEV mode...")

		// Start Docker sidecars (Redis, PG) using shared logic
		StartServices(true)

		if workerOnly {
			UIInfo("Starting WORKER ONLY...")
			backendCmd = exec.Command("cmd", "/C", "cd backend && set RUN_MODE=worker && "+cfg.DevConfig.BackendCommand)
		} else {
			backendCmd = exec.Command("cmd", "/C", "cd backend && "+cfg.DevConfig.BackendCommand)
			frontendCmd = exec.Command("cmd", "/C", "cd "+cfg.FrontendPath+" && "+cfg.DevConfig.FrontendCommand)
		}
	} else {
		UIInfo("Starting PRODUCTION mode...")
		if workerOnly {
			UIInfo("Starting WORKER ONLY...")
			backendCmd = exec.Command("cmd", "/C", "cd backend && set RUN_MODE=worker && "+cfg.ProdConfig.BackendCommand)
		} else {
			backendCmd = exec.Command("cmd", "/C", "cd backend && "+cfg.ProdConfig.BackendCommand)
			frontendCmd = exec.Command("cmd", "/C", "cd "+cfg.FrontendPath+" && "+cfg.ProdConfig.FrontendCommand)
		}
	}

	// Pipes
	var backendStdout, backendStderr io.ReadCloser
	var frontendStdout, frontendStderr io.ReadCloser

	backendStdout, _ = backendCmd.StdoutPipe()
	backendStderr, _ = backendCmd.StderrPipe()

	if frontendCmd != nil {
		frontendStdout, _ = frontendCmd.StdoutPipe()
		frontendStderr, _ = frontendCmd.StderrPipe()
	}

	// Start processes
	if err := backendCmd.Start(); err != nil {
		UIError("Failed to start server: %v", err)
		return
	}

	if frontendCmd != nil {
		if err := frontendCmd.Start(); err != nil {
			UIError("Failed to start client: %v", err)
			backendCmd.Process.Kill()
			return
		}
	}

	// Colors
	backendColor := color.New(color.FgGreen).SprintFunc()
	frontendColor := color.New(color.FgCyan).SprintFunc()

	// Stream logs
	go streamLogs(backendStdout, backendColor("[server]"))
	go streamLogs(backendStderr, backendColor("[server]"))

	if frontendCmd != nil {
		go streamLogs(frontendStdout, frontendColor("[client]"))
		go streamLogs(frontendStderr, frontendColor("[client]"))
	}

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigChan
		fmt.Println("\n🛑 Shutting down...")

		if backendCmd != nil && backendCmd.Process != nil {
			backendCmd.Process.Signal(syscall.SIGTERM)
		}
		if frontendCmd != nil && frontendCmd.Process != nil {
			frontendCmd.Process.Signal(syscall.SIGTERM)
		}

		if cfg.IsDev() {
			StopServices()
		}
	}()

	// Wait for processes
	backendCmd.Wait()
	if frontendCmd != nil {
		frontendCmd.Wait()
	}
}

// streamLogs reads from a pipe and prints with prefix
func streamLogs(reader io.Reader, prefix string) {
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		line := scanner.Text()
		fmt.Printf("%s %s\n", prefix, LogLevelColor(line))
	}
}
