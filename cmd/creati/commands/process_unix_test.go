//go:build !windows

package commands

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"
)

func TestRunProcessesStopsShellDescendants(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	ready := filepath.Join(t.TempDir(), "child-pid")
	process := shellCommand(`
trap 'kill "$child" 2>/dev/null; wait "$child"; exit 0' TERM
sleep 60 &
child=$!
echo "$child" > "$CREATI_TEST_READY"
wait "$child"
`, "")
	process.Env = append(os.Environ(), "CREATI_TEST_READY="+ready)
	done := make(chan error, 1)
	go func() { done <- runProcesses(ctx, process) }()
	pid, err := strconv.Atoi(strings.TrimSpace(string(waitForFile(t, ready))))
	if err != nil {
		t.Fatal(err)
	}
	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("shell did not stop")
	}
	if err := syscall.Kill(pid, 0); !errors.Is(err, syscall.ESRCH) {
		t.Fatalf("shell child %d is still alive: %v", pid, err)
	}
}

func TestRunProcessesKillsDescendantsThatIgnoreTermination(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("uses Linux process status to distinguish a dead child from a running one")
	}
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	ready := filepath.Join(t.TempDir(), "child-pid")
	process := shellCommand(`
trap 'exit 0' TERM
sh -c 'trap "" TERM; echo $$ > "$CREATI_TEST_READY"; exec sleep 60' &
wait
`, "")
	process.Env = append(os.Environ(), "CREATI_TEST_READY="+ready)
	done := make(chan error, 1)
	go func() { done <- runProcesses(ctx, process) }()
	pid := strings.TrimSpace(string(waitForFile(t, ready)))
	childPID, err := strconv.Atoi(pid)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { syscall.Kill(childPID, syscall.SIGKILL) })
	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("shell did not stop")
	}
	for deadline := time.Now().Add(time.Second); time.Now().Before(deadline); {
		status, err := os.ReadFile(filepath.Join("/proc", pid, "status"))
		if os.IsNotExist(err) || strings.Contains(string(status), "State:\tZ") {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("child %s survived its shell", pid)
}

func TestComposePluginAndStandalone(t *testing.T) {
	for _, pluginStatus := range []string{"0", "1"} {
		t.Run(pluginStatus, func(t *testing.T) {
			dir := t.TempDir()
			for name, script := range map[string]string{
				"docker":         "#!/bin/sh\nif [ \"$2\" = version ]; then exit " + pluginStatus + "; fi\nshift\necho plugin:$*\n",
				"docker-compose": "#!/bin/sh\necho standalone:$*\n",
			} {
				if err := os.WriteFile(filepath.Join(dir, name), []byte(script), 0755); err != nil {
					t.Fatal(err)
				}
			}
			t.Setenv("PATH", dir)
			output, err := composeCommand("up", "-d").Output()
			want := "plugin:up -d"
			if pluginStatus != "0" {
				want = "standalone:up -d"
			}
			if err != nil || strings.TrimSpace(string(output)) != want {
				t.Fatalf("Compose output = %q, error = %v; want %q", output, err, want)
			}
		})
	}
}
