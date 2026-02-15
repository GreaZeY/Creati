package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	if err := godotenv.Load(); err != nil {
		fmt.Println("No .env file found, using system env")
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL not set")
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatal("DB ping failed:", err)
	}

	// Resolve absolute path to migrations
	cwd, err := os.Getwd()
	if err != nil {
		log.Fatal("Failed to get CWD:", err)
	}
	migrationsDir := filepath.Join(cwd, "internal", "db", "migrations")
	fmt.Println("📂 Searching for migrations in:", migrationsDir)

	files, err := os.ReadDir(migrationsDir)
	if err != nil {
		log.Fatal("Failed to read migrations dir:", err)
	}

	var migrationFiles []string
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".sql") {
			migrationFiles = append(migrationFiles, file.Name())
		}
	}

	sort.Strings(migrationFiles)

	for _, file := range migrationFiles {
		path := filepath.Join(migrationsDir, file)

		sqlBytes, err := os.ReadFile(path)
		if err != nil {
			log.Fatalf("❌ Read failed (%s): %v\n", path, err)
		}

		_, err = db.Exec(string(sqlBytes))
		if err != nil {
			// Check if error is "duplicate column", if so, ignore it?
			// But for now, let's just log and fail.
			// Actually, since we use IF NOT EXISTS in SQL, it should not fail on duplicate.
			log.Fatalf("❌ Migration failed (%s): %v\n", file, err)
		}

		fmt.Println("✅ Applied migration:", file)
	}

	fmt.Println("All migrations applied successfully")
}
