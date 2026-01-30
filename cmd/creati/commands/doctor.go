package commands

import (
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"

	"github.com/fatih/color"
	"github.com/spf13/cobra"
)

var doctorCmd = &cobra.Command{
	Use:   "doctor",
	Short: "Check development environment",
	Long:  `Runs health checks on your development environment`,
	Run:   runDoctor,
}

func init() {
	rootCmd.AddCommand(doctorCmd)
}

func runDoctor(cmd *cobra.Command, args []string) {
	cfg := GetConfig()

	green := color.New(color.FgGreen).SprintFunc()
	red := color.New(color.FgRed).SprintFunc()

	checks := []struct {
		name    string
		checker func() bool
	}{
		{"Go installed", checkGo},
		{"Node.js installed", checkNode},
		{"npm installed", checkNpm},
		{"Frontend dependencies", checkFrontendDeps},
		{"Backend dependencies", checkBackendDeps},
		{fmt.Sprintf("Port %d available", cfg.DevConfig.FrontendPort), func() bool {
			return checkPort(cfg.DevConfig.FrontendPort)
		}},
		{fmt.Sprintf("Port %d available", cfg.DevConfig.BackendPort), func() bool {
			return checkPort(cfg.DevConfig.BackendPort)
		}},
		{".env files present", checkEnvFiles},
	}

	fmt.Println("🏥 Running health checks...\n")

	passed := 0
	for _, check := range checks {
		if check.checker() {
			fmt.Printf("%s %s\n", green("✓"), check.name)
			passed++
		} else {
			fmt.Printf("%s %s\n", red("✗"), check.name)
		}
	}

	fmt.Printf("\n%d/%d checks passed\n", passed, len(checks))

	if passed == len(checks) {
		fmt.Println(green("✨ Your development environment is ready!"))
	} else {
		fmt.Println(red("⚠️  Some checks failed. Please fix the issues above."))
	}
}

func checkGo() bool {
	cmd := exec.Command("go", "version")
	return cmd.Run() == nil
}

func checkNode() bool {
	cmd := exec.Command("node", "--version")
	return cmd.Run() == nil
}

func checkNpm() bool {
	cmd := exec.Command("npm", "--version")
	return cmd.Run() == nil
}

func checkFrontendDeps() bool {
	_, err := os.Stat("frontend/node_modules")
	return err == nil
}

func checkBackendDeps() bool {
	cmd := exec.Command("go", "list", "-m")
	cmd.Dir = "backend"
	return cmd.Run() == nil
}

func checkPort(port int) bool {
	cmd := exec.Command("netstat", "-ano")
	output, err := cmd.Output()
	if err != nil {
		return true // Assume available if netstat fails
	}

	portStr := ":" + strconv.Itoa(port)
	return !strings.Contains(string(output), portStr)
}

func checkEnvFiles() bool {
	files := []string{
		"backend/.env",
	}

	for _, file := range files {
		if _, err := os.Stat(file); os.IsNotExist(err) {
			return false
		}
	}
	return true
}
