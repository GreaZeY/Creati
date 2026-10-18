package commands

import (
	"os/exec"
	"runtime"
	"strings"
)

func shellCommand(command, dir string) *exec.Cmd {
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("cmd", "/C", command)
	} else {
		cmd = exec.Command("sh", "-c", command)
	}
	cmd.Dir = dir
	return cmd
}

func executableName(path string) string {
	if runtime.GOOS == "windows" && !strings.HasSuffix(strings.ToLower(path), ".exe") {
		return path + ".exe"
	}
	return path
}
