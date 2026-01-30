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

var startCmd = &cobra.Command{
	Use:   "start",
	Short: "Start frontend and backend",
	Long:  `Starts both frontend and backend services with prefixed colored logs`,
	Run:   runStart,
}

func runStart(cmd *cobra.Command, args []string) {
	cfg := GetConfig()

	var backendCmd, frontendCmd *exec.Cmd

	if cfg.IsDev() {
		// Development mode
		fmt.Println("🚀 Starting in DEV mode...")

		// Start backend with air
		backendCmd = exec.Command("cmd", "/C", "cd backend && "+cfg.DevConfig.BackendCommand)

		// Start frontend with npm run dev
		frontendCmd = exec.Command("cmd", "/C", "cd "+cfg.FrontendPath+" && "+cfg.DevConfig.FrontendCommand)
	} else {
		// Production mode
		fmt.Println("🚀 Starting in PRODUCTION mode...")

		// Start backend binary
		backendCmd = exec.Command("cmd", "/C", "cd backend && "+cfg.ProdConfig.BackendCommand)

		// Start frontend (assuming built and served via backend)
		frontendCmd = exec.Command("cmd", "/C", "cd "+cfg.FrontendPath+" && "+cfg.ProdConfig.FrontendCommand)
	}

	// Set up colored log prefixes
	backendColor := color.New(color.FgCyan).SprintFunc()
	frontendColor := color.New(color.FgGreen).SprintFunc()

	// Pipe outputs with prefixes
	backendStdout, _ := backendCmd.StdoutPipe()
	backendStderr, _ := backendCmd.StderrPipe()
	frontendStdout, _ := frontendCmd.StdoutPipe()
	frontendStderr, _ := frontendCmd.StderrPipe()

	// Start both processes
	if err := backendCmd.Start(); err != nil {
		fmt.Println("❌ Failed to start backend:", err)
		return
	}

	if err := frontendCmd.Start(); err != nil {
		fmt.Println("❌ Failed to start frontend:", err)
		backendCmd.Process.Kill()
		return
	}

	// Stream logs with prefixes
	go streamLogs(backendStdout, backendColor("[backend]"))
	go streamLogs(backendStderr, backendColor("[backend]"))
	go streamLogs(frontendStdout, frontendColor("[frontend]"))
	go streamLogs(frontendStderr, frontendColor("[frontend]"))

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigChan
		fmt.Println("\n🛑 Shutting down...")

		if backendCmd.Process != nil {
			backendCmd.Process.Signal(syscall.SIGTERM)
		}
		if frontendCmd.Process != nil {
			frontendCmd.Process.Signal(syscall.SIGTERM)
		}
	}()

	// Wait for both to complete
	backendCmd.Wait()
	frontendCmd.Wait()
}

// streamLogs reads from a pipe and prints with prefix
func streamLogs(reader io.Reader, prefix string) {
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		fmt.Printf("%s %s\n", prefix, scanner.Text())
	}
}
