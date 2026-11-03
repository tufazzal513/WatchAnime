package sync

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"

	"movex/internal/config"
	"movex/internal/repo"
)

// SyncResponse is returned by the main server to workers.
type SyncResponse struct {
	Changes   []repo.ChangeItem `json:"changes"`
	SinceSeq  int64             `json:"since_seq"`
	LatestSeq int64             `json:"latest_seq"`
	HasMore   bool              `json:"has_more"`
}

// Handler handles replication requests on the main server.
type Handler struct {
	cfg      *config.Config
	userRepo *repo.UserRepo
}

// NewHandler creates a new replication API handler for main server.
func NewHandler(cfg *config.Config, userRepo *repo.UserRepo) *Handler {
	return &Handler{
		cfg:      cfg,
		userRepo: userRepo,
	}
}

// HandleChanges validates the worker key and streams changes since since_seq.
func (h *Handler) HandleChanges(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	workerKey := r.Header.Get("X-Worker-Key")
	if workerKey == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "missing X-Worker-Key header"})
		return
	}

	// Hash worker key to compare against database
	hash := sha256.Sum256([]byte(workerKey))
	keyHash := hex.EncodeToString(hash[:])

	worker, err := h.userRepo.GetWorkerByKeyHash(keyHash)
	if err != nil {
		slog.Error("worker lookup error", "err", err)
		http.Error(w, `{"error":"internal server error"}`, http.StatusInternalServerError)
		return
	}
	if worker == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "unauthorized worker key"})
		return
	}

	// Parse since_seq and limit
	var sinceSeq int64 = 0
	if s := r.URL.Query().Get("since_seq"); s != "" {
		if n, err := strconv.ParseInt(s, 10, 64); err == nil && n >= 0 {
			sinceSeq = n
		}
	}

	limit := 100
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 500 {
			limit = n
		}
	}

	// Update worker heartbeat and URL if sent
	workerURL := r.Header.Get("X-Worker-URL")
	_ = h.userRepo.UpdateWorkerHeartbeat(keyHash, workerURL, sinceSeq)

	// Fetch changes
	changes, _, hasMore, err := h.userRepo.GetChanges(sinceSeq, limit)
	if err != nil {
		slog.Error("failed to query replication changes", "err", err)
		http.Error(w, `{"error":"failed to retrieve changes"}`, http.StatusInternalServerError)
		return
	}

	latestSeq, _ := h.userRepo.GetMaxSeq()

	resp := SyncResponse{
		Changes:   changes,
		SinceSeq:  sinceSeq,
		LatestSeq: latestSeq,
		HasMore:   hasMore,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}
