package db

import (
	"os"
	"path/filepath"
	"testing"
)

func TestOpenMemoryDB(t *testing.T) {
	db, err := Open(":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}
	defer db.Close()

	// Verify tables exist
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='movies'").Scan(&count)
	if err != nil || count != 1 {
		t.Fatalf("expected 'movies' table to exist, count=%d, err=%v", count, err)
	}

	err = db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='schema_migrations'").Scan(&count)
	if err != nil || count != 1 {
		t.Fatalf("expected 'schema_migrations' table to exist, count=%d, err=%v", count, err)
	}
}

func TestOpenFileDBAndIdempotentMigrations(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "movex-db-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	dbFile := filepath.Join(tempDir, "test.db")
	db1, err := Open(dbFile)
	if err != nil {
		t.Fatalf("failed to open file db: %v", err)
	}
	_ = db1.Close()

	// Reopening must not fail (migrations must be idempotent)
	db2, err := Open(dbFile)
	if err != nil {
		t.Fatalf("failed to re-open file db: %v", err)
	}
	defer db2.Close()

	var version int
	err = db2.QueryRow("SELECT version FROM schema_migrations WHERE version=1").Scan(&version)
	if err != nil || version != 1 {
		t.Fatalf("expected migration version 1, got %d, err=%v", version, err)
	}
}
