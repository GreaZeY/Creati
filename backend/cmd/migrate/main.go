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
		log.Fatal("DB Ping failed:", err)
	}

	migrationSQL, err := os.ReadFile("internal/db/migrations/007_automation.sql")
	if err != nil {
		log.Fatal(err)
	}

	_, err = db.Exec(string(migrationSQL))
	if err != nil {
		log.Fatal("Migration failed:", err)
	}

	fmt.Println("Migration 007_automation applied successfully")
}
