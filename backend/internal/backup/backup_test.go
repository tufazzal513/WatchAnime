package backup

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"movex/internal/config"
	_ "modernc.org/sqlite"
)

func setupTestDB(t *testing.T, dir string) (*sql.DB, string) {
	t.Helper()
	dbPath := filepath.Join(dir, "movex.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS test_items (id TEXT PRIMARY KEY, val TEXT);
		INSERT INTO test_items VALUES ('1', 'hello'), ('2', 'world');
	`)
	if err != nil {
		t.Fatalf("failed to seed test db: %v", err)
	}

	return db, dbPath
}

func TestRunBackupAndRestore(t *testing.T) {
	tmpDir := t.TempDir()
	db, dbPath := setupTestDB(t, tmpDir)
	defer db.Close()

	cfg := &config.Config{
		DataDir: tmpDir,
		TgKeep:  5,
	}

	// 1. Run Backup
	res, err := RunBackup(cfg, db)
	if err != nil {
		t.Fatalf("RunBackup failed: %v", err)
	}

	if res.FilePath == "" {
		t.Fatalf("expected non-empty FilePath")
	}
	if res.Size <= 0 {
		t.Fatalf("expected positive file size, got %d", res.Size)
	}

	// Verify file exists on disk
	if _, err := os.Stat(res.FilePath); err != nil {
		t.Fatalf("backup file does not exist on disk: %v", err)
	}

	// 2. Modify original database
	_, err = db.Exec("INSERT INTO test_items VALUES ('3', 'new_unbacked_item');")
	if err != nil {
		t.Fatalf("failed to insert: %v", err)
	}

	// Close DB so we can restore
	db.Close()

	// 3. Restore from backup
	if err := Restore(dbPath, res.FilePath); err != nil {
		t.Fatalf("Restore failed: %v", err)
	}

	// 4. Reopen and verify restored state
	restoredDB, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("failed to open restored db: %v", err)
	}
	defer restoredDB.Close()

	var count int
	if err := restoredDB.QueryRow("SELECT COUNT(*) FROM test_items").Scan(&count); err != nil {
		t.Fatalf("failed to query restored db: %v", err)
	}
	if count != 2 {
		t.Fatalf("expected 2 items after restore, got %d", count)
	}
}

func TestRotateBackups(t *testing.T) {
	tmpDir := t.TempDir()
	backupDir := filepath.Join(tmpDir, "backups")
	if err := os.MkdirAll(backupDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Create 5 dummy backup files with staggered timestamps
	for i := 1; i <= 5; i++ {
		fn := filepath.Join(backupDir, fmt.Sprintf("movex_%02d.db.gz", i))
		if err := os.WriteFile(fn, []byte("dummy backup content"), 0644); err != nil {
			t.Fatal(err)
		}
		// Adjust mod time
		modTime := time.Now().Add(time.Duration(i) * time.Minute)
		_ = os.Chtimes(fn, modTime, modTime)
	}

	// Keep only 2
	if err := RotateBackups(backupDir, 2); err != nil {
		t.Fatalf("RotateBackups failed: %v", err)
	}

	entries, err := os.ReadDir(backupDir)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 2 {
		t.Fatalf("expected 2 remaining backups after rotation, got %d", len(entries))
	}

	// The newest two should be 05 and 04
	names := make(map[string]bool)
	for _, e := range entries {
		names[e.Name()] = true
	}
	if !names["movex_05.db.gz"] || !names["movex_04.db.gz"] {
		t.Fatalf("expected movex_05 and movex_04 to remain, got %v", names)
	}
}

func TestSendToTelegramMock(t *testing.T) {
	receivedDocName := ""
	receivedChatID := ""
	receivedCaption := ""

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("expected POST, got %s", r.Method)
		}
		err := r.ParseMultipartForm(10 << 20)
		if err != nil {
			t.Fatalf("failed to parse multipart: %v", err)
		}

		receivedChatID = r.FormValue("chat_id")
		receivedCaption = r.FormValue("caption")

		file, header, err := r.FormFile("document")
		if err != nil {
			t.Fatalf("missing document file: %v", err)
		}
		defer file.Close()
		receivedDocName = header.Filename

		data, _ := io.ReadAll(file)
		if string(data) != "fake compressed db data" {
			t.Errorf("unexpected content: %s", string(data))
		}

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, `{"ok": true, "result": {"message_id": 123}}`)
	}))
	defer mockServer.Close()

	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "test_snapshot.db.gz")
	if err := os.WriteFile(filePath, []byte("fake compressed db data"), 0644); err != nil {
		t.Fatal(err)
	}

	err := sendToTelegramWithURL(mockServer.URL, "-100123456789", filePath, "MoveX Snapshot Test")
	if err != nil {
		t.Fatalf("sendToTelegramWithURL failed: %v", err)
	}

	if receivedChatID != "-100123456789" {
		t.Errorf("expected chat id -100123456789, got %s", receivedChatID)
	}
	if receivedCaption != "MoveX Snapshot Test" {
		t.Errorf("expected caption MoveX Snapshot Test, got %s", receivedCaption)
	}
	if receivedDocName != "test_snapshot.db.gz" {
		t.Errorf("expected document name test_snapshot.db.gz, got %s", receivedDocName)
	}
}

func TestBackupSchedulerContextCancel(t *testing.T) {
	tmpDir := t.TempDir()
	db, _ := setupTestDB(t, tmpDir)
	defer db.Close()

	cfg := &config.Config{
		DataDir:          tmpDir,
		BackupEveryHours: 24,
	}

	ctx, cancel := context.WithCancel(context.Background())
	StartScheduler(ctx, cfg, db)
	// Cancel immediately to verify clean shutdown without panic
	cancel()
	time.Sleep(10 * time.Millisecond)
}
