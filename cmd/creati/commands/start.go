package commands

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/fatih/color"
	"github.com/spf13/cobra"
)

var workerOnly bool

var startCmd = &cobra.Command{
	Use:   "start",
	Short: "Start frontend and backend",
	Long:  `Starts both frontend and backend services with prefixed colored logs`,
	RunE:  runStart,
}

func init() {
	startCmd.Flags().BoolVarP(&workerOnly, "worker-only", "w", false, "Start only the backend worker")
	rootCmd.AddCommand(startCmd)
}

func runStart(cmd *cobra.Command, args []string) error {
	cfg := GetConfig()
	backendCommand := cfg.ProdConfig.BackendCommand
	frontendCommand := cfg.ProdConfig.FrontendCommand

	if cfg.IsDev() {
		UISuccess("Starting in DEV mode...")
		backendCommand = cfg.DevConfig.BackendCommand
		frontendCommand = cfg.DevConfig.FrontendCommand
		if err := StartServices(); err != nil {
			return err
		}
		defer func() {
			if err := StopServices(); err != nil {
				UIWarning("Failed to stop services: %v", err)
			}
		}()
	} else {
		UIInfo("Starting PRODUCTION mode...")
	}

	backendCmd := shellCommand(backendCommand, cfg.BackendPath)
	commands := []*exec.Cmd{backendCmd}
	if workerOnly {
		UIInfo("Starting WORKER ONLY...")
		backendCmd.Env = append(backendCmd.Environ(), "RUN_MODE=worker")
	} else {
		commands = append(commands, shellCommand(frontendCommand, cfg.FrontendPath))
	}

	ctx, stop := signal.NotifyContext(cmd.Context(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	return runProcesses(ctx, commands...)
}

func runProcesses(ctx context.Context, commands ...*exec.Cmd) error {
	exits := make(chan error, len(commands))
	var started []*exec.Cmd
	pending := 0

	defer func() {
		for _, process := range started {
			if err := stopProcess(process, false); err != nil {
				UIWarning("Failed to stop process: %v", err)
			}
		}

		timer := time.NewTimer(5 * time.Second)
		defer timer.Stop()
		for pending > 0 {
			select {
			case <-exits:
				pending--
			case <-timer.C:
				for _, process := range started {
					if err := stopProcess(process, true); err != nil {
						UIWarning("Failed to kill process: %v", err)
					}
				}
			}
		}
		// A shell may exit before descendants that ignored SIGTERM.
		if runtime.GOOS != "windows" {
			for _, process := range started {
				if err := stopProcess(process, true); err != nil {
					UIWarning("Failed to stop descendants: %v", err)
				}
			}
		}
	}()

	for i, process := range commands {
		configureProcess(process)
		stdout, err := process.StdoutPipe()
		if err != nil {
			return err
		}
		stderr, err := process.StderrPipe()
		if err != nil {
			stdout.Close()
			return err
		}
		if err := process.Start(); err != nil {
			stdout.Close()
			stderr.Close()
			return fmt.Errorf("start process in %s: %w", process.Dir, err)
		}
		started = append(started, process)
		pending++

		prefix := color.GreenString("[server]")
		if i > 0 {
			prefix = color.CyanString("[client]")
		}
		go streamLogs(stdout, prefix)
		go streamLogs(stderr, prefix)
		go func() { exits <- process.Wait() }()
	}

	for pending > 0 {
		select {
		case <-ctx.Done():
			UIInfo("Shutting down...")
			return nil
		case err := <-exits:
			pending--
			if err != nil {
				return fmt.Errorf("service exited: %w", err)
			}
		}
	}
	return nil
}

// streamLogs reads from a pipe and prints with prefix
func streamLogs(reader io.Reader, prefix string) {
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		line := scanner.Text()
		fmt.Printf("%s %s\n", prefix, LogLevelColor(line))
	}
}
