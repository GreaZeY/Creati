package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

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

	// Read migration file
	content, err := os.ReadFile("internal/db/migrations/002_add_profile_name.sql")
	if err != nil {
		log.Fatal(err)
	}

	_, err = db.Exec(string(content))
	if err != nil {
		log.Fatal("Migration failed:", err)
	}

	fmt.Println("Migration successful!")
}
