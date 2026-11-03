package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"movex/internal/auth"
	"movex/internal/config"
	"movex/internal/db"
	"movex/internal/presence"
	"movex/internal/repo"
)

func setupTestApp(t *testing.T) (*http.ServeMux, *repo.MovieRepo, *repo.CatalogRepo, *repo.UserRepo) {
	database, err := db.Open(":memory:")
	if err != nil {
		t.Fatalf("failed to open test database: %v", err)
	}

	cfg := &config.Config{
		Role:            "main",
		AllowedOrigins:  []string{"*"},
		DevInsecureAuth: true,
	}

	mRepo := repo.NewMovieRepo(database)
	cRepo := repo.NewCatalogRepo(database)
	uRepo := repo.NewUserRepo(database)
	pTracker := presence.NewTracker()
	verifier := auth.NewTokenVerifier("test-proj", true)

	serverHandler := NewServerHandler(cfg, "1.0.0", nil)
	userAPI := NewUserAPIHandler(cfg, mRepo, cRepo, uRepo, pTracker)

	mux := http.NewServeMux()
	RegisterUserAPIRoutes(mux, cfg, userAPI, serverHandler, verifier, uRepo)

	return mux, mRepo, cRepo, uRepo
}

func TestPublicEndpoints(t *testing.T) {
	mux, _, cRepo, _ := setupTestApp(t)

	// Set a public setting
	_ = cRepo.SetSetting("app_name", "MoveX Stream")

	// 1. GET /api/v1/settings/public
	req := httptest.NewRequest(http.MethodGet, "/api/v1/settings/public", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rr.Code)
	}
	var res map[string]map[string]string
	_ = json.Unmarshal(rr.Body.Bytes(), &res)
	if res["settings"]["app_name"] != "MoveX Stream" {
		t.Errorf("expected setting app_name to be 'MoveX Stream', got %s", res["settings"]["app_name"])
	}

	// 2. POST /api/v1/auth/password-reset
	payload := bytes.NewBufferString(`{"email":"user@example.com"}`)
	reqReset := httptest.NewRequest(http.MethodPost, "/api/v1/auth/password-reset", payload)
	rrReset := httptest.NewRecorder()
	mux.ServeHTTP(rrReset, reqReset)

	if rrReset.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for pwd reset, got %d", rrReset.Code)
	}
}

func TestMoviesCatalogAPI(t *testing.T) {
	mux, mRepo, _, _ := setupTestApp(t)

	// Insert movie
	m := &repo.Movie{
		Title:       "Interstellar",
		ContentType: "movie",
		Year:        2014,
		Rating:      8.6,
		Industry:    "Hollywood",
		Language:    "English",
		Genres:      "Sci-Fi, Adventure",
	}
	_ = mRepo.SaveMovie(m, []string{"Sci-Fi"}, nil, nil, nil)

	// 1. Unauthenticated request -> 401
	reqNoAuth := httptest.NewRequest(http.MethodGet, "/api/v1/movies", nil)
	rrNoAuth := httptest.NewRecorder()
	mux.ServeHTTP(rrNoAuth, reqNoAuth)
	if rrNoAuth.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized, got %d", rrNoAuth.Code)
	}

	// 2. Authenticated list request -> 200
	reqList := httptest.NewRequest(http.MethodGet, "/api/v1/movies?q=Interstellar", nil)
	reqList.Header.Set("Authorization", "Bearer dev:user-123")
	rrList := httptest.NewRecorder()
	mux.ServeHTTP(rrList, reqList)

	if rrList.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rrList.Code)
	}
	var listRes struct {
		Movies []*repo.Movie `json:"movies"`
		Total  int           `json:"total"`
	}
	_ = json.Unmarshal(rrList.Body.Bytes(), &listRes)
	if listRes.Total != 1 || len(listRes.Movies) != 1 {
		t.Fatalf("expected 1 movie in list, got %d", listRes.Total)
	}

	// 3. Get single movie details
	reqGet := httptest.NewRequest(http.MethodGet, "/api/v1/movies/"+m.ID, nil)
	reqGet.Header.Set("Authorization", "Bearer dev:user-123")
	rrGet := httptest.NewRecorder()
	mux.ServeHTTP(rrGet, reqGet)

	if rrGet.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rrGet.Code)
	}

	// 4. Increment views
	reqView := httptest.NewRequest(http.MethodPost, "/api/v1/movies/"+m.ID+"/view", nil)
	reqView.Header.Set("Authorization", "Bearer dev:user-123")
	rrView := httptest.NewRecorder()
	mux.ServeHTTP(rrView, reqView)

	if rrView.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for view increment, got %d", rrView.Code)
	}
}

func TestUserProfileAndLists(t *testing.T) {
	mux, mRepo, _, _ := setupTestApp(t)

	movie := &repo.Movie{Title: "Your Name", ContentType: "movie", Year: 2016}
	_ = mRepo.SaveMovie(movie, nil, nil, nil, nil)

	token := "Bearer dev:user-test-456"

	// 1. GET /api/v1/me (Auto creates user profile from token)
	reqMe := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	reqMe.Header.Set("Authorization", token)
	rrMe := httptest.NewRecorder()
	mux.ServeHTTP(rrMe, reqMe)

	if rrMe.Code != http.StatusOK {
		t.Fatalf("expected 200 for /me, got %d", rrMe.Code)
	}

	// 2. PUT /api/v1/me (Update profile)
	updatePayload := bytes.NewBufferString(`{"name":"AnimeFan","avatar":"https://avatar.url"}`)
	reqUpdate := httptest.NewRequest(http.MethodPut, "/api/v1/me", updatePayload)
	reqUpdate.Header.Set("Authorization", token)
	rrUpdate := httptest.NewRecorder()
	mux.ServeHTTP(rrUpdate, reqUpdate)

	if rrUpdate.Code != http.StatusOK {
		t.Fatalf("expected 200 for update /me, got %d", rrUpdate.Code)
	}

	// 3. PUT /api/v1/me/list/{movieId}
	reqAddList := httptest.NewRequest(http.MethodPut, "/api/v1/me/list/"+movie.ID, nil)
	reqAddList.Header.Set("Authorization", token)
	rrAddList := httptest.NewRecorder()
	mux.ServeHTTP(rrAddList, reqAddList)

	if rrAddList.Code != http.StatusOK {
		t.Fatalf("expected 200 for AddToMyList, got %d", rrAddList.Code)
	}

	// 4. GET /api/v1/me/list
	reqGetList := httptest.NewRequest(http.MethodGet, "/api/v1/me/list", nil)
	reqGetList.Header.Set("Authorization", token)
	rrGetList := httptest.NewRecorder()
	mux.ServeHTTP(rrGetList, reqGetList)

	var listRes struct {
		MyList []*repo.Movie `json:"myList"`
	}
	_ = json.Unmarshal(rrGetList.Body.Bytes(), &listRes)
	if len(listRes.MyList) != 1 || listRes.MyList[0].ID != movie.ID {
		t.Fatalf("expected 1 movie in MyList, got %d", len(listRes.MyList))
	}

	// 5. DELETE /api/v1/me/list/{movieId}
	reqDelList := httptest.NewRequest(http.MethodDelete, "/api/v1/me/list/"+movie.ID, nil)
	reqDelList.Header.Set("Authorization", token)
	rrDelList := httptest.NewRecorder()
	mux.ServeHTTP(rrDelList, reqDelList)

	if rrDelList.Code != http.StatusOK {
		t.Fatalf("expected 200 for RemoveFromMyList, got %d", rrDelList.Code)
	}

	// 6. PUT /api/v1/me/progress/{movieId}
	progPayload := bytes.NewBufferString(`{"t":350.5,"d":1200}`)
	reqProg := httptest.NewRequest(http.MethodPut, "/api/v1/me/progress/"+movie.ID, progPayload)
	reqProg.Header.Set("Authorization", token)
	rrProg := httptest.NewRecorder()
	mux.ServeHTTP(rrProg, reqProg)

	if rrProg.Code != http.StatusOK {
		t.Fatalf("expected 200 for UpdateProgress, got %d", rrProg.Code)
	}

	// 7. GET /api/v1/me/progress
	reqGetProg := httptest.NewRequest(http.MethodGet, "/api/v1/me/progress", nil)
	reqGetProg.Header.Set("Authorization", token)
	rrGetProg := httptest.NewRecorder()
	mux.ServeHTTP(rrGetProg, reqGetProg)

	if rrGetProg.Code != http.StatusOK {
		t.Fatalf("expected 200 for GetProgress, got %d", rrGetProg.Code)
	}
}

func TestPresenceAndFeedback(t *testing.T) {
	mux, _, _, _ := setupTestApp(t)
	token := "Bearer dev:user-feedback-789"

	// 1. Presence heartbeat
	reqPresence := httptest.NewRequest(http.MethodPost, "/api/v1/presence", nil)
	reqPresence.Header.Set("Authorization", token)
	rrPresence := httptest.NewRecorder()
	mux.ServeHTTP(rrPresence, reqPresence)

	if rrPresence.Code != http.StatusOK {
		t.Fatalf("expected 200 for presence, got %d", rrPresence.Code)
	}

	// 2. Broken link report
	blPayload := bytes.NewBufferString(`{
		"movieId": "m-123",
		"title": "Jujutsu Kaisen",
		"type": "series",
		"epInfo": "Ep 1",
		"serverType": "VIDEASY",
		"note": "Audio out of sync"
	}`)
	reqBL := httptest.NewRequest(http.MethodPost, "/api/v1/broken-links", blPayload)
	reqBL.Header.Set("Authorization", token)
	rrBL := httptest.NewRecorder()
	mux.ServeHTTP(rrBL, reqBL)

	if rrBL.Code != http.StatusOK {
		t.Fatalf("expected 200 for broken-links, got %d", rrBL.Code)
	}

	// 3. Client error report
	errPayload := bytes.NewBufferString(`{
		"message": "Uncaught TypeError in player.js:42",
		"stack": "Error at line 42",
		"clientInfo": "Chrome 122"
	}`)
	reqErr := httptest.NewRequest(http.MethodPost, "/api/v1/errors", errPayload)
	reqErr.Header.Set("Authorization", token)
	rrErr := httptest.NewRecorder()
	mux.ServeHTTP(rrErr, reqErr)

	if rrErr.Code != http.StatusOK {
		t.Fatalf("expected 200 for error logging, got %d", rrErr.Code)
	}

	// 4. Search Suggestion & Hit
	hitPayload := bytes.NewBufferString(`{"term":"One Piece"}`)
	reqHit := httptest.NewRequest(http.MethodPost, "/api/v1/search/hit", hitPayload)
	reqHit.Header.Set("Authorization", token)
	rrHit := httptest.NewRecorder()
	mux.ServeHTTP(rrHit, reqHit)

	if rrHit.Code != http.StatusOK {
		t.Fatalf("expected 200 for search hit, got %d", rrHit.Code)
	}

	reqSuggest := httptest.NewRequest(http.MethodGet, "/api/v1/search/suggest?q=One", nil)
	reqSuggest.Header.Set("Authorization", token)
	rrSuggest := httptest.NewRecorder()
	mux.ServeHTTP(rrSuggest, reqSuggest)

	if rrSuggest.Code != http.StatusOK {
		t.Fatalf("expected 200 for search suggest, got %d", rrSuggest.Code)
	}
}
