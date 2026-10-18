package commands

import (
	"context"
	"errors"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/spf13/cobra"
)

func testConfig(t *testing.T) *Config {
	t.Helper()
	previousConfig, previousWorkerOnly := config, workerOnly
	t.Cleanup(func() { config, workerOnly = previousConfig, previousWorkerOnly })
	root := filepath.Join(t.TempDir(), "project with spaces")
	config = &Config{
		Mode:         "prod",
		BackendPath:  filepath.Join(root, "backend with spaces"),
		FrontendPath: filepath.Join(root, "frontend with spaces"),
	}
	for _, dir := range []string{config.BackendPath, config.FrontendPath} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatal(err)
		}
	}
	config.ProdConfig.BackendBin = filepath.Join(root, "bin", "server")
	return config
}

func TestWorkerOnlyUsesConfiguredDirectoryAndEnvironment(t *testing.T) {
	cfg := testConfig(t)
	t.Setenv("RUN_MODE", "all")
	workerOnly = true
	cfg.ProdConfig.BackendCommand = `echo "$RUN_MODE" > worker-mode.txt`
	if runtime.GOOS == "windows" {
		cfg.ProdConfig.BackendCommand = `echo %RUN_MODE%> worker-mode.txt`
	}
	cfg.ProdConfig.FrontendCommand = "exit 9"
	cmd := &cobra.Command{}
	cmd.SetContext(context.Background())
	if err := runStart(cmd, nil); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(cfg.BackendPath, "worker-mode.txt"))
	if err != nil || strings.TrimSpace(string(data)) != "worker" {
		t.Fatalf("worker mode = %q, error = %v", data, err)
	}
}

func TestBuildUsesSeparateBackendModule(t *testing.T) {
	cfg := testConfig(t)
	cfg.ProdConfig.FrontendCommand = "echo built > frontend-built.txt"
	appDir := filepath.Join(cfg.BackendPath, "cmd", "app")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		t.Fatal(err)
	}
	for path, content := range map[string]string{
		filepath.Join(cfg.BackendPath, "go.mod"): "module example.com/fixture\n\ngo 1.25.0\n",
		filepath.Join(appDir, "main.go"):         "package main\nimport \"fmt\"\nfunc main() { fmt.Println(\"fixture backend\") }\n",
	} {
		if err := os.WriteFile(path, []byte(content), 0644); err != nil {
			t.Fatal(err)
		}
	}
	t.Setenv("PATH", filepath.Join(runtime.GOROOT(), "bin")+string(os.PathListSeparator)+os.Getenv("PATH"))
	t.Setenv("GOFLAGS", os.Getenv("GOFLAGS")+" -buildvcs=false")
	if err := runBuild(nil, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(cfg.FrontendPath, "frontend-built.txt")); err != nil {
		t.Fatal(err)
	}
	output, err := exec.Command(executableName(cfg.ProdConfig.BackendBin)).Output()
	if err != nil || strings.TrimSpace(string(output)) != "fixture backend" {
		t.Fatalf("backend output = %q, error = %v", output, err)
	}
}

func TestBuildPropagatesFrontendFailure(t *testing.T) {
	cfg := testConfig(t)
	cfg.ProdConfig.FrontendCommand = "exit 7"
	var exitErr *exec.ExitError
	if err := runBuild(nil, nil); !errors.As(err, &exitErr) || exitErr.ExitCode() != 7 {
		t.Fatalf("expected exit code 7, got %v", err)
	}
	if _, err := os.Stat(executableName(cfg.ProdConfig.BackendBin)); !os.IsNotExist(err) {
		t.Fatalf("backend build should not run: %v", err)
	}
}

func TestCheckPort(t *testing.T) {
	listener, err := net.Listen("tcp", ":0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { listener.Close() })
	port := listener.Addr().(*net.TCPAddr).Port
	if checkPort(port) {
		t.Fatal("occupied port reported available")
	}
	if err := listener.Close(); err != nil {
		t.Fatal(err)
	}
	if !checkPort(port) {
		t.Fatal("released port reported occupied")
	}
}

func TestServiceProcess(t *testing.T) {
	mode := os.Getenv("CREATI_TEST_CHILD")
	if mode == "" {
		return
	}
	if mode == "fail" {
		os.Exit(9)
	}
	if ready := os.Getenv("CREATI_TEST_READY"); ready != "" {
		if err := os.WriteFile(ready, []byte(strconv.Itoa(os.Getpid())), 0644); err != nil {
			os.Exit(10)
		}
	}
	for {
		time.Sleep(time.Hour)
	}
}

func serviceProcess(mode, ready string) *exec.Cmd {
	cmd := exec.Command(os.Args[0], "-test.run=^TestServiceProcess$")
	cmd.Env = append(os.Environ(), "CREATI_TEST_CHILD="+mode, "CREATI_TEST_READY="+ready)
	return cmd
}

func waitForFile(t *testing.T, path string) []byte {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if data, err := os.ReadFile(path); err == nil && len(data) > 0 {
			return data
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for %s", path)
	return nil
}

func TestRunProcessesCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	ready := filepath.Join(t.TempDir(), "ready")
	process := serviceProcess("wait", ready)
	done := make(chan error, 1)
	go func() { done <- runProcesses(ctx, process) }()
	waitForFile(t, ready)
	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("process did not stop after cancellation")
	}
	if process.ProcessState == nil {
		t.Fatal("child was not reaped")
	}
}

func TestRunProcessesCleansUpOnFailure(t *testing.T) {
	for _, startFailure := range []bool{false, true} {
		t.Run(strconv.FormatBool(startFailure), func(t *testing.T) {
			first := serviceProcess("wait", "")
			second := serviceProcess("fail", "")
			if startFailure {
				second = exec.Command(filepath.Join(t.TempDir(), "missing-program"))
			}
			if err := runProcesses(context.Background(), first, second); err == nil {
				t.Fatal("service failure was not returned")
			}
			if first.ProcessState == nil {
				t.Fatal("sibling process was not stopped and reaped")
			}
		})
	}
}
