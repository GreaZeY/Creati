package api

import (
	"database/sql"
	"fmt"
	"io"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/lib/pq"
)

// Uses disposable schemas; set this explicitly to a PostgreSQL database with CREATE privileges.
func TestRegistrationSubscriptionSchema(t *testing.T) {
	databaseURL := os.Getenv("CREATI_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("CREATI_TEST_DATABASE_URL is not set")
	}
	t.Setenv("JWT_SECRET", "registration-integration-test-only")
	initial, err := os.ReadFile(filepath.Join("..", "db", "migrations", "00_init_schema.sql"))
	if err != nil {
		t.Fatal(err)
	}
	migration, err := os.ReadFile(filepath.Join("..", "db", "migrations", "14_subscription_schema.sql"))
	if err != nil {
		t.Fatal(err)
	}
	for _, legacy := range []bool{false, true} {
		t.Run(fmt.Sprintf("legacy=%t", legacy), func(t *testing.T) {
			db, err := sql.Open("postgres", databaseURL)
			if err != nil {
				t.Fatal("cannot configure test database")
			}
			db.SetMaxOpenConns(1)
			t.Cleanup(func() { db.Close() })
			schema := pq.QuoteIdentifier(fmt.Sprintf("creati_auth_test_%d", time.Now().UnixNano()))
			exec := func(query string) {
				t.Helper()
				if _, err := db.Exec(query); err != nil {
					t.Fatal(err)
				}
			}
			exec("CREATE SCHEMA " + schema)
			t.Cleanup(func() {
				if _, err := db.Exec("DROP SCHEMA " + schema + " CASCADE"); err != nil {
					t.Error(err)
				}
			})
			exec("SET search_path TO " + schema + ", public")
			tableDDL := func(name string) string {
				t.Helper()
				_, rest, found := strings.Cut(string(initial), "CREATE TABLE IF NOT EXISTS "+name+" (")
				body, _, end := strings.Cut(rest, ");")
				if !found || !end {
					t.Fatalf("missing table DDL for %s", name)
				}
				return "CREATE TABLE " + name + " (" + body + ");"
			}
			exec(tableDDL("users"))
			if legacy {
				exec(`CREATE TABLE subscriptions (
					id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
					stripe_subscription_id VARCHAR(255) UNIQUE, plan_name VARCHAR(100) NOT NULL,
					status VARCHAR(50) DEFAULT 'active', current_period_start TIMESTAMP,
					current_period_end TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
				)`)
				exec(`INSERT INTO users (email) VALUES ('existing@example.invalid')`)
				exec(`INSERT INTO subscriptions (user_id, plan_name, stripe_subscription_id)
					SELECT id, 'pro', 'existing-stripe-id' FROM users`)
			} else {
				exec(tableDDL("subscriptions"))
			}
			exec(string(migration))
			exec(string(migration)) // Reapplying must preserve existing subscriptions.
			if legacy {
				var plan, stripe string
				if err := db.QueryRow(`SELECT plan, stripe_subscription_id FROM subscriptions`).Scan(&plan, &stripe); err != nil {
					t.Fatal(err)
				}
				if plan != "pro" || stripe != "existing-stripe-id" {
					t.Fatalf("legacy subscription changed: %q, %q", plan, stripe)
				}
			}

			handler := NewAuthHandler(db)
			app := fiber.New()
			app.Post("/register", handler.Register)
			app.Post("/login", handler.Login)
			request := func(path, email string, status int) {
				t.Helper()
				body := fmt.Sprintf(`{"email":%q,"password":"test-password-123","firstName":"Test","lastName":"Account"}`, email)
				req := httptest.NewRequest("POST", path, strings.NewReader(body))
				req.Header.Set("Content-Type", "application/json")
				resp, err := app.Test(req, 10000)
				if err != nil {
					t.Fatal(err)
				}
				defer resp.Body.Close()
				if resp.StatusCode != status {
					data, _ := io.ReadAll(resp.Body)
					t.Fatalf("%s: got %d, want %d: %s", path, resp.StatusCode, status, data)
				}
			}
			request("/register", "signup@example.invalid", fiber.StatusCreated)
			request("/login", "signup@example.invalid", fiber.StatusOK)
			var plan, cycle, status string
			var hasPeriod bool
			if err := db.QueryRow(`SELECT s.plan, s.billing_cycle, s.status, s.current_period_end > NOW()
				FROM subscriptions s JOIN users u ON u.id = s.user_id
				WHERE u.email = 'signup@example.invalid'`).Scan(&plan, &cycle, &status, &hasPeriod); err != nil {
				t.Fatal(err)
			}
			if plan != "free" || cycle != "monthly" || status != "active" || !hasPeriod {
				t.Fatalf("unexpected subscription: %q %q %q future period=%t", plan, cycle, status, hasPeriod)
			}

			exec(`ALTER TABLE subscriptions ADD CONSTRAINT reject_test_signup CHECK (plan <> 'free') NOT VALID`)
			request("/register", "rollback@example.invalid", fiber.StatusInternalServerError)
			var count int
			if err := db.QueryRow(`SELECT COUNT(*) FROM users WHERE email = 'rollback@example.invalid'`).Scan(&count); err != nil || count != 0 {
				t.Fatalf("failed signup left a user: count=%d error=%v", count, err)
			}
		})
	}
}
