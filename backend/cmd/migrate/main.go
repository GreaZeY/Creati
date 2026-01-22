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

	migrationsDir := "internal/db/migrations"

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

	var failed bool

	for _, file := range migrationFiles {
		path := filepath.Join(migrationsDir, file)

		sqlBytes, err := os.ReadFile(path)
		if err != nil {
			log.Printf("✗ Read failed (%s): %v\n", file, err)
			failed = true
			continue
		}

		_, err = db.Exec(string(sqlBytes))
		if err != nil {
			log.Printf("✗ Migration failed (%s): %v\n", file, err)
			failed = true
			continue
		}

		fmt.Println("✓ Applied migration:", file)
	}

	if failed {
		fmt.Println("Migrations completed with errors")
	} else {
		fmt.Println("All migrations applied successfully")
	}
}
