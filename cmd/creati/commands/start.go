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
}

func runStart(cmd *cobra.Command, args []string) {
	cfg := GetConfig()

	var backendCmd, frontendCmd *exec.Cmd

	if cfg.IsDev() {
		fmt.Println("🚀 Starting in DEV mode...")
		if workerOnly {
			fmt.Println("👷 Starting WORKER ONLY...")
			backendCmd = exec.Command("cmd", "/C", "cd backend && set RUN_MODE=worker && "+cfg.DevConfig.BackendCommand)
		} else {
			backendCmd = exec.Command("cmd", "/C", "cd backend && "+cfg.DevConfig.BackendCommand)
			frontendCmd = exec.Command("cmd", "/C", "cd "+cfg.FrontendPath+" && "+cfg.DevConfig.FrontendCommand)
		}
	} else {
		fmt.Println("🚀 Starting in PRODUCTION mode...")
		if workerOnly {
			fmt.Println("👷 Starting WORKER ONLY...")
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
		fmt.Println("❌ Failed to start backend:", err)
		return
	}

	if frontendCmd != nil {
		if err := frontendCmd.Start(); err != nil {
			fmt.Println("❌ Failed to start frontend:", err)
			backendCmd.Process.Kill()
			return
		}
	}

	// Colors
	backendColor := color.New(color.FgCyan).SprintFunc()
	frontendColor := color.New(color.FgGreen).SprintFunc()

	// Stream logs
	go streamLogs(backendStdout, backendColor("[backend]"))
	go streamLogs(backendStderr, backendColor("[backend]"))

	if frontendCmd != nil {
		go streamLogs(frontendStdout, frontendColor("[frontend]"))
		go streamLogs(frontendStderr, frontendColor("[frontend]"))
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
		fmt.Printf("%s %s\n", prefix, scanner.Text())
	}
}
