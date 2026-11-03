package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"movex/internal/config"
)

func TestHandleHealth(t *testing.T) {
	cfg := &config.Config{Role: "main"}
	h := NewServerHandler(cfg, "1.0.0", nil)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()

	h.HandleHealth(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var res HealthResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if !res.OK {
		t.Errorf("expected ok=true")
	}
	if res.Role != "main" {
		t.Errorf("expected role='main', got %s", res.Role)
	}
	if res.Version != "1.0.0" {
		t.Errorf("expected version='1.0.0', got %s", res.Version)
	}
}

func TestHandleServers(t *testing.T) {
	cfg := &config.Config{Role: "main"}
	h := NewServerHandler(cfg, "1.0.0", func() []ServerInfo {
		return []ServerInfo{
			{Name: "Worker-1", URL: "https://worker1.example.com", LastSeen: 123456789},
		}
	})

	req := httptest.NewRequest(http.MethodGet, "/servers", nil)
	rr := httptest.NewRecorder()

	h.HandleServers(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var res struct {
		Servers []ServerInfo `json:"servers"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(res.Servers) != 1 {
		t.Fatalf("expected 1 server, got %d", len(res.Servers))
	}
	if res.Servers[0].Name != "Worker-1" {
		t.Errorf("expected 'Worker-1', got %s", res.Servers[0].Name)
	}
}
