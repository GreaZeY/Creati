package commands

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/spf13/cobra"
)

var updateCmd = &cobra.Command{
	Use:   "self-update",
	Short: "Rebuild the creati CLI binary",
	Long:  `Rebuilds the creati binary from source and replaces the current one in the tools directory.`,
	Run:   runSelfUpdate,
}

func runSelfUpdate(cmd *cobra.Command, args []string) {
	fmt.Println("🔄 Rebuilding creati CLI...")

	buildCmd := exec.Command("go", "build", "-o", "tools/creati.exe", "./cmd/creati")
	buildCmd.Stdout = os.Stdout
	buildCmd.Stderr = os.Stderr

	if err := buildCmd.Run(); err != nil {
		fmt.Printf("❌ Failed to rebuild CLI: %v\n", err)
		return
	}

	fmt.Println("✅ creati CLI successfully updated!")
}
