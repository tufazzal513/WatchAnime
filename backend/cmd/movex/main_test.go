package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"movex/internal/api"
	"movex/internal/config"
)

func TestHealthEndpoint(t *testing.T) {
	cfg := &config.Config{
		Role: "main",
	}
	serverHandler := api.NewServerHandler(cfg, Version, nil)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", serverHandler.HandleHealth)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()

	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var res api.HealthResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to parse json: %v", err)
	}

	if !res.OK || res.Role != "main" {
		t.Fatalf("unexpected response: %+v", res)
	}
}

func TestCLIBackupAndRestore(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("DATA_DIR", tmpDir)
	t.Setenv("ROLE", "main")

	// 1. Run backup command
	if err := runBackupCmd(); err != nil {
		t.Fatalf("runBackupCmd failed: %v", err)
	}

	// Find the created backup
	backups, err := os.ReadDir(tmpDir + "/backups")
	if err != nil || len(backups) == 0 {
		t.Fatalf("expected backup file created: %v", err)
	}

	backupFile := tmpDir + "/backups/" + backups[0].Name()

	// 2. Run restore command
	if err := runRestoreCmd(backupFile); err != nil {
		t.Fatalf("runRestoreCmd failed: %v", err)
	}
}
