package commands

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/spf13/cobra"
)

var migrateCmd = &cobra.Command{
	Use:   "migrate",
	Short: "Run database migrations",
	Long:  `Runs the migration script located in backend/cmd/migrate/main.go`,
	Run:   runMigrate,
}

func runMigrate(cmd *cobra.Command, args []string) {
	fmt.Println("🚀 Running database migrations...")

	migrateCmd := exec.Command("go", "run", "./cmd/migrate/main.go")
	migrateCmd.Dir = "backend"
	migrateCmd.Stdout = os.Stdout
	migrateCmd.Stderr = os.Stderr

	if err := migrateCmd.Run(); err != nil {
		fmt.Printf("❌ Migration failed: %v\n", err)
		return
	}

	fmt.Println("✅ Migrations completed successfully!")
}
