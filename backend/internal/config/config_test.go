package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestConfigDefaults(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "movex-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	oldPort := os.Getenv("PORT")
	os.Setenv("PORT", "3000")
	defer func() {
		if oldPort != "" {
			os.Setenv("PORT", oldPort)
		} else {
			os.Unsetenv("PORT")
		}
	}()

	os.Setenv("DATA_DIR", tempDir)
	defer os.Unsetenv("DATA_DIR")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected Load to succeed, got %v", err)
	}

	if cfg.Role != "main" {
		t.Errorf("expected role 'main', got %q", cfg.Role)
	}
	if cfg.Port != 3000 {
		t.Errorf("expected port 3000, got %d", cfg.Port)
	}
	if len(cfg.SessionSecret) < 32 {
		t.Errorf("expected session secret to have at least 32 bytes, got %d", len(cfg.SessionSecret))
	}

	// Verify session secret was saved
	keyPath := filepath.Join(tempDir, "session.key")
	if _, err := os.Stat(keyPath); os.IsNotExist(err) {
		t.Errorf("session.key was not persisted to %s", keyPath)
	}
}

func TestConfigWorkerValidation(t *testing.T) {
	os.Setenv("ROLE", "worker")
	defer os.Unsetenv("ROLE")
	os.Unsetenv("MAIN_URL")
	os.Unsetenv("WORKER_KEY")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error when worker missing MAIN_URL")
	}

	os.Setenv("MAIN_URL", "https://main.example.com")
	defer os.Unsetenv("MAIN_URL")

	_, err = Load()
	if err == nil {
		t.Fatal("expected error when worker missing WORKER_KEY")
	}

	os.Setenv("WORKER_KEY", "secret123")
	defer os.Unsetenv("WORKER_KEY")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected worker config to succeed, got %v", err)
	}
	if cfg.Role != "worker" {
		t.Errorf("expected worker role, got %s", cfg.Role)
	}
}

func TestIsAdmin(t *testing.T) {
	cfg := &Config{
		Role:      "main",
		AdminUIDs: []string{"uid-admin-1", "uid-admin-2"},
	}

	if !cfg.IsAdmin("uid-admin-1") {
		t.Errorf("expected uid-admin-1 to be admin")
	}
	if cfg.IsAdmin("uid-random") {
		t.Errorf("expected uid-random not to be admin")
	}

	// Worker should always return false for admin
	cfg.Role = "worker"
	if cfg.IsAdmin("uid-admin-1") {
		t.Errorf("worker role must never permit admin actions")
	}
}
