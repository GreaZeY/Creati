package services

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"io"
	"strings"
	"testing"

	"creati.in/creati/backend/internal/services/storage"
)

func init() {
	sql.Register("creati-storage-test", storageTestDriver{})
}

func TestGetProvider(t *testing.T) {
	for _, providerType := range []string{"gdrive", "dropbox", "s3_custom", ""} {
		t.Run(providerType, func(t *testing.T) {
			db, err := sql.Open("creati-storage-test", providerType)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { db.Close() })
			fallback := &storage.LocalProvider{}
			service := &StorageService{db: db, defaultProvider: fallback}
			provider, err := service.GetProvider(context.Background(), 1)
			if providerType == "gdrive" || providerType == "dropbox" {
				if err == nil || !strings.Contains(err.Error(), providerType) || provider != nil {
					t.Fatalf("unsupported provider must return an error, got %T, %v", provider, err)
				}
				return
			}
			if err != nil || provider != fallback {
				t.Fatalf("expected default provider, got %T, %v", provider, err)
			}
		})
	}
}

type storageTestDriver struct{}

func (storageTestDriver) Open(provider string) (driver.Conn, error) {
	return storageTestConn{provider: provider}, nil
}

type storageTestConn struct{ provider string }

func (storageTestConn) Prepare(string) (driver.Stmt, error) {
	return nil, errors.New("unexpected Prepare")
}
func (storageTestConn) Close() error { return nil }
func (storageTestConn) Begin() (driver.Tx, error) {
	return nil, errors.New("unexpected Begin")
}
func (c storageTestConn) QueryContext(_ context.Context, query string, _ []driver.NamedValue) (driver.Rows, error) {
	if strings.Contains(query, "FROM subscriptions") {
		return &storageTestRows{columns: []string{"plan"}, values: []driver.Value{"pro"}}, nil
	}
	if strings.Contains(query, "FROM organization_storage_configs") {
		rows := &storageTestRows{columns: []string{"provider_type", "credentials"}}
		if c.provider != "" {
			rows.values = []driver.Value{c.provider, []byte(`{}`)}
		}
		return rows, nil
	}
	return nil, errors.New("unexpected query")
}

type storageTestRows struct {
	columns []string
	values  []driver.Value
}

func (r *storageTestRows) Columns() []string { return r.columns }
func (r *storageTestRows) Close() error      { return nil }
func (r *storageTestRows) Next(dest []driver.Value) error {
	if r.values == nil {
		return io.EOF
	}
	copy(dest, r.values)
	r.values = nil
	return nil
}
