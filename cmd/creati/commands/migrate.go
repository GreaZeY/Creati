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
	RunE:  runMigrate,
}

func init() {
	rootCmd.AddCommand(migrateCmd)
}

func runMigrate(cmd *cobra.Command, args []string) error {
	UIInfo("Running database migrations...")

	migrateCmd := exec.Command("go", "run", "./cmd/migrate/main.go")
	migrateCmd.Dir = GetConfig().BackendPath
	migrateCmd.Stdout = os.Stdout
	migrateCmd.Stderr = os.Stderr

	if err := migrateCmd.Run(); err != nil {
		return fmt.Errorf("migration failed: %w", err)
	}

	UISuccess("Migrations completed successfully!")
	return nil
}
