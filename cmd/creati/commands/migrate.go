package commands

import (
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

func init() {
	rootCmd.AddCommand(migrateCmd)
}

func runMigrate(cmd *cobra.Command, args []string) {
	UIInfo("Running database migrations...")

	migrateCmd := exec.Command("go", "run", "./cmd/migrate/main.go")
	migrateCmd.Dir = "backend"
	migrateCmd.Stdout = os.Stdout
	migrateCmd.Stderr = os.Stderr

	if err := migrateCmd.Run(); err != nil {
		UIError("Migration failed: %v", err)
		return
	}

	UISuccess("Migrations completed successfully!")
}
