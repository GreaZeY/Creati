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
	_ = godotenv.Load()
	dbURL := os.Getenv("DATABASE_URL")
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	rows, err := db.Query("SELECT id, rule_id, status, error, updated_at FROM automation_jobs ORDER BY updated_at DESC LIMIT 50")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	fmt.Println("ID | Rule | Status | Error | Updated At")
	fmt.Println("---|------|--------|-------|-----------")
	for rows.Next() {
		var id, ruleID int
		var status string
		var errMsg sql.NullString
		var updatedAt string
		if err := rows.Scan(&id, &ruleID, &status, &errMsg, &updatedAt); err != nil {
			log.Fatal(err)
		}
		errVal := "NULL"
		if errMsg.Valid {
			errVal = errMsg.String
		}
		fmt.Printf("%d | %d | %s | %s | %s\n", id, ruleID, status, errVal, updatedAt)
	}
}
