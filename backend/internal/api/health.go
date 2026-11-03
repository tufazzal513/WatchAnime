package api

import (
	"encoding/json"
	"net/http"

	"movex/internal/config"
)

type HealthResponse struct {
	OK      bool   `json:"ok"`
	Role    string `json:"role"`
	Version string `json:"version"`
}

type ServerInfo struct {
	Name     string `json:"name"`
	URL      string `json:"url"`
	LastSeen int64  `json:"last_seen"`
}

type ServerHandler struct {
	cfg     *config.Config
	version string
	// Active servers provider
	getServers func() []ServerInfo
}

func NewServerHandler(cfg *config.Config, version string, getServers func() []ServerInfo) *ServerHandler {
	return &ServerHandler{
		cfg:        cfg,
		version:    version,
		getServers: getServers,
	}
}

// HandleHealth returns current server health and role.
func (h *ServerHandler) HandleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(HealthResponse{
		OK:      true,
		Role:    h.cfg.Role,
		Version: h.version,
	})
}

// HandleServers returns the list of active worker servers.
func (h *ServerHandler) HandleServers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	var list []ServerInfo
	if h.getServers != nil {
		list = h.getServers()
	}
	if list == nil {
		list = []ServerInfo{}
	}
	_ = json.NewEncoder(w).Encode(map[string]any{
		"servers": list,
	})
}
