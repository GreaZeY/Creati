package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		// Fallback to default local credentials
		dbURL = "postgres://postgres:postgres@localhost:5432/creati?sslmode=disable"
		fmt.Println("⚠️  DATABASE_URL not set, using default:", dbURL)
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// Read migration files
	files, err := os.ReadDir("internal/db/migrations")
	if err != nil {
		log.Fatal(err)
	}

	for _, file := range files {
		if file.IsDir() || !strings.HasSuffix(file.Name(), ".sql") {
			continue
		}

		fmt.Printf("Running migration: %s... ", file.Name())
		content, err := os.ReadFile("internal/db/migrations/" + file.Name())
		if err != nil {
			log.Fatal(err)
		}

		_, err = db.Exec(string(content))
		if err != nil {
			log.Printf("❌ Migration %s failed: %v", file.Name(), err)
			continue
		}
		fmt.Println("✅")
	}

	fmt.Println("\nAll migrations processed!")
}
