package sync

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"movex/internal/config"
	"movex/internal/db"
	"movex/internal/repo"
	_ "modernc.org/sqlite"
)

func setupTestDB(t *testing.T, dir, filename string) (*sql.DB, string) {
	t.Helper()
	p := filepath.Join(dir, filename)
	database, err := db.Open(p)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}
	return database, p
}

func TestReplicationAuthAndSync(t *testing.T) {
	tmpDir := t.TempDir()
	mainDB, _ := setupTestDB(t, tmpDir, "main.db")
	defer mainDB.Close()

	workerDB, _ := setupTestDB(t, tmpDir, "worker.db")
	defer workerDB.Close()

	mainUserRepo := repo.NewUserRepo(mainDB)
	mainMovieRepo := repo.NewMovieRepo(mainDB)
	mainCatalogRepo := repo.NewCatalogRepo(mainDB)

	workerUserRepo := repo.NewUserRepo(workerDB)
	workerMovieRepo := repo.NewMovieRepo(workerDB)
	workerCatalogRepo := repo.NewCatalogRepo(workerDB)

	// Register a worker on main
	plainKey := "test-secret-worker-key-12345"
	hash := sha256.Sum256([]byte(plainKey))
	keyHash := hex.EncodeToString(hash[:])

	workerRecord := &repo.WorkerInfo{
		Name:    "Replica-East",
		KeyHash: keyHash,
		Created: time.Now().UnixMilli(),
	}
	if err := mainUserRepo.SaveWorker(workerRecord); err != nil {
		t.Fatalf("failed to save worker record: %v", err)
	}

	cfg := &config.Config{
		Role: "main",
	}
	syncHandler := NewHandler(cfg, mainUserRepo)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/sync/changes", syncHandler.HandleChanges)
	server := httptest.NewServer(mux)
	defer server.Close()

	// 1. Test missing key -> 401
	resp, err := http.Get(server.URL + "/api/v1/sync/changes")
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 for missing key, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// 2. Test invalid key -> 401
	req, _ := http.NewRequest("GET", server.URL+"/api/v1/sync/changes", nil)
	req.Header.Set("X-Worker-Key", "invalid-key")
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 for invalid key, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// 3. Test valid key on empty changes
	req, _ = http.NewRequest("GET", server.URL+"/api/v1/sync/changes", nil)
	req.Header.Set("X-Worker-Key", plainKey)
	req.Header.Set("X-Worker-URL", "https://worker1.example.com")
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for valid key, got %d", resp.StatusCode)
	}

	var syncResp SyncResponse
	if err := json.NewDecoder(resp.Body).Decode(&syncResp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	resp.Body.Close()

	if len(syncResp.Changes) != 0 {
		t.Fatalf("expected 0 changes initially, got %d", len(syncResp.Changes))
	}

	// Verify worker heartbeat and URL were recorded
	savedWorker, err := mainUserRepo.GetWorkerByKeyHash(keyHash)
	if err != nil || savedWorker == nil {
		t.Fatalf("failed to get worker by hash: %v", err)
	}
	if savedWorker.URL != "https://worker1.example.com" {
		t.Fatalf("expected URL to be saved, got %s", savedWorker.URL)
	}
	if savedWorker.LastSeen <= 0 {
		t.Fatalf("expected LastSeen > 0, got %d", savedWorker.LastSeen)
	}

	// 4. Create sample entities on Main: Movie, Category, Banner, Setting
	movie := &repo.Movie{
		ID:          "m1",
		Title:       "Inception",
		ContentType: "movie",
		Year:        2010,
		Rating:      8.8,
	}
	streamLinks := []repo.StreamLink{
		{ServerType: "VIDSRC", URL: "https://vidsrc.me/embed/m1", Label: "Server 1"},
	}
	err = mainMovieRepo.SaveMovie(movie, []string{"Sci-Fi", "Action"}, streamLinks, nil, nil)
	if err != nil {
		t.Fatalf("failed to save movie on main: %v", err)
	}

	err = mainCatalogRepo.SaveCategory(&repo.Category{ID: "cat1", Name: "Sci-Fi", SortOrder: 1})
	if err != nil {
		t.Fatalf("failed to save category: %v", err)
	}

	err = mainCatalogRepo.SaveBanner(&repo.Banner{ID: "b1", Title: "Epic Sci-Fi", ImageURL: "https://img.com/b1.jpg", Active: true})
	if err != nil {
		t.Fatalf("failed to save banner: %v", err)
	}

	err = mainCatalogRepo.SetSetting("site_name", "MoveX Production")
	if err != nil {
		t.Fatalf("failed to set setting: %v", err)
	}

	// 5. Worker sync iteration
	workerCfg := &config.Config{
		Role:         "worker",
		MainURL:      server.URL,
		WorkerKey:    plainKey,
		PublicURL:    "https://worker1.example.com",
		SyncEverySec: 1,
	}

	// Run sync on worker
	hasMore := runSyncIteration(http.DefaultClient, workerCfg, workerDB, workerUserRepo)
	if hasMore {
		t.Errorf("expected hasMore to be false for small batch")
	}

	// 6. Verify replicated data in Worker Database!
	workerMovie, err := workerMovieRepo.GetMovie("m1")
	if err != nil || workerMovie == nil {
		t.Fatalf("expected movie m1 on worker db: %v", err)
	}
	if workerMovie.Title != "Inception" {
		t.Fatalf("expected title Inception, got %s", workerMovie.Title)
	}

	workerCats, err := workerCatalogRepo.ListCategories()
	if err != nil || len(workerCats) == 0 {
		t.Fatalf("expected categories on worker db: %v", err)
	}

	workerBanners, err := workerCatalogRepo.ListBanners(true)
	if err != nil || len(workerBanners) == 0 {
		t.Fatalf("expected banners on worker db: %v", err)
	}

	workerSetting, err := workerCatalogRepo.GetSetting("site_name")
	if err != nil || workerSetting != "MoveX Production" {
		t.Fatalf("expected site_name 'MoveX Production', got %q", workerSetting)
	}

	// Verify worker meta last_seq
	lastSeqStr, err := workerUserRepo.GetMeta("last_seq")
	if err != nil || lastSeqStr == "" || lastSeqStr == "0" {
		t.Fatalf("expected non-zero last_seq in worker meta: %v (val: %s)", err, lastSeqStr)
	}

	// 7. Test Deletions propagation
	err = mainMovieRepo.DeleteMovie("m1")
	if err != nil {
		t.Fatalf("failed to delete movie on main: %v", err)
	}
	err = mainCatalogRepo.DeleteBanner("b1")
	if err != nil {
		t.Fatalf("failed to delete banner on main: %v", err)
	}

	// Worker syncs again
	runSyncIteration(http.DefaultClient, workerCfg, workerDB, workerUserRepo)

	// Verify movie and banner are gone from worker
	delMovie, _ := workerMovieRepo.GetMovie("m1")
	if delMovie != nil {
		t.Fatalf("expected movie m1 to be deleted from worker db, still found: %+v", delMovie)
	}

	delBanners, _ := workerCatalogRepo.ListBanners(false)
	if len(delBanners) != 0 {
		t.Fatalf("expected banners to be deleted on worker, got %d", len(delBanners))
	}
}
