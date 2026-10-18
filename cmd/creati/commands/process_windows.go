package commands

import (
	"errors"
	"os"
	"os/exec"
	"strconv"
)

func configureProcess(cmd *exec.Cmd) {}

func stopProcess(cmd *exec.Cmd, force bool) error {
	// Windows does not support SIGTERM; taskkill also stops shell descendants.
	if err := exec.Command("taskkill", "/PID", strconv.Itoa(cmd.Process.Pid), "/T", "/F").Run(); err == nil {
		return nil
	}
	err := cmd.Process.Kill()
	if errors.Is(err, os.ErrProcessDone) {
		return nil
	}
	return err
}
