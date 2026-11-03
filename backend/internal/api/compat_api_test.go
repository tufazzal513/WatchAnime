package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"movex/internal/config"
	"movex/internal/db"
	"movex/internal/presence"
	"movex/internal/repo"
	_ "modernc.org/sqlite"
)

func TestCompatAPI(t *testing.T) {
	tmpDir := t.TempDir()
	database, err := db.Open(filepath.Join(tmpDir, "movex.db"))
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}
	defer database.Close()

	movieRepo := repo.NewMovieRepo(database)
	catalogRepo := repo.NewCatalogRepo(database)
	userRepo := repo.NewUserRepo(database)
	pTracker := presence.NewTracker()

	cfg := &config.Config{Role: "main"}
	compat := NewCompatAPIHandler(cfg, movieRepo, catalogRepo, userRepo, pTracker)

	mux := http.NewServeMux()
	mux.HandleFunc("/api/db/", compat.HandleDB)

	// Seed movie, banner, category, setting
	err = movieRepo.SaveMovie(&repo.Movie{
		ID:          "m100",
		Title:       "Interstellar",
		ContentType: "movie",
		Year:        2014,
		Rating:      8.7,
		Genres:      "Sci-Fi",
	}, []string{"Sci-Fi"}, nil, nil, nil)
	if err != nil {
		t.Fatalf("failed to save movie: %v", err)
	}

	_ = catalogRepo.SaveBanner(&repo.Banner{ID: "b1", Title: "Banner 1", ImageURL: "https://b.jpg", Active: true})
	_ = catalogRepo.SaveCategory(&repo.Category{ID: "c1", Name: "Sci-Fi"})
	_ = catalogRepo.SetSetting("site_name", "MoveX Platform")

	// 1. Test GET /api/db/movies
	req := httptest.NewRequest("GET", "/api/db/movies", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var moviesMap map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &moviesMap); err != nil {
		t.Fatalf("failed to parse movies json: %v", err)
	}
	if _, ok := moviesMap["m100"]; !ok {
		t.Fatalf("expected m100 in movies map: %+v", moviesMap)
	}

	// 2. Test GET /api/db/movies/m100
	req = httptest.NewRequest("GET", "/api/db/movies/m100", nil)
	rr = httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	// 3. Test GET /api/db/banners
	req = httptest.NewRequest("GET", "/api/db/banners", nil)
	rr = httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var bannersMap map[string]any
	_ = json.Unmarshal(rr.Body.Bytes(), &bannersMap)
	if _, ok := bannersMap["b1"]; !ok {
		t.Fatalf("expected b1 in banners map")
	}

	// 4. Test GET /api/db/settings
	req = httptest.NewRequest("GET", "/api/db/settings", nil)
	rr = httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	var settingsMap map[string]string
	_ = json.Unmarshal(rr.Body.Bytes(), &settingsMap)
	if settingsMap["site_name"] != "MoveX Platform" {
		t.Fatalf("expected site_name MoveX Platform, got %s", settingsMap["site_name"])
	}

	// 5. Test MyList /api/db/users/user123/myList/m100
	req = httptest.NewRequest("PUT", "/api/db/users/user123/myList/m100", nil)
	rr = httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	// GET MyList
	req = httptest.NewRequest("GET", "/api/db/users/user123/myList", nil)
	rr = httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	var myList map[string]any
	_ = json.Unmarshal(rr.Body.Bytes(), &myList)
	if _, ok := myList["m100"]; !ok {
		t.Fatalf("expected m100 in myList")
	}

	// 6. Test Watch Progress /api/db/users/user123/progress/m100
	req = httptest.NewRequest("PUT", "/api/db/users/user123/progress/m100", strings.NewReader(`{"t": 120.5, "d": 7200.0}`))
	rr = httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	req = httptest.NewRequest("GET", "/api/db/users/user123/progress", nil)
	rr = httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	var progMap map[string]any
	_ = json.Unmarshal(rr.Body.Bytes(), &progMap)
	if _, ok := progMap["m100"]; !ok {
		t.Fatalf("expected m100 in progress")
	}

	// 7. Test Online Presence /api/db/online_users/user123
	req = httptest.NewRequest("PUT", "/api/db/online_users/user123", nil)
	rr = httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if pTracker.LiveCount() != 1 {
		t.Fatalf("expected 1 live user, got %d", pTracker.LiveCount())
	}
}
