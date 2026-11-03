package admin

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"movex/internal/auth"
	"movex/internal/config"
	"movex/internal/db"
	"movex/internal/presence"
	"movex/internal/repo"
)

func setupAdminTest(t *testing.T) (*http.ServeMux, *AdminHandler, *auth.AdminManager, *repo.MovieRepo) {
	database, err := db.Open(":memory:")
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	cfg := &config.Config{
		Role:          "main",
		AdminUIDs:     []string{"admin-test-uid"},
		SessionSecret: []byte("super-secure-32-byte-secret-hmac!"),
		CookieSecure:  false,
	}

	mRepo := repo.NewMovieRepo(database)
	cRepo := repo.NewCatalogRepo(database)
	uRepo := repo.NewUserRepo(database)
	pTracker := presence.NewTracker()
	adminMgr := auth.NewAdminManager(cfg)

	adminHandler, err := NewAdminHandler(cfg, adminMgr, mRepo, cRepo, uRepo, pTracker)
	if err != nil {
		t.Fatalf("failed to initialize admin handler: %v", err)
	}

	mux := http.NewServeMux()
	RegisterAdminRoutes(mux, adminHandler, adminMgr)

	return mux, adminHandler, adminMgr, mRepo
}

func getAuthCookie(adminMgr *auth.AdminManager) *http.Cookie {
	rec := httptest.NewRecorder()
	adminMgr.SetAdminSession(rec, "admin-test-uid")
	return rec.Result().Cookies()[0]
}

func TestAdminLoginAndDashboard(t *testing.T) {
	mux, _, adminMgr, _ := setupAdminTest(t)

	// 1. GET /admin/login -> 200 OK
	reqLogin := httptest.NewRequest(http.MethodGet, "/admin/login", nil)
	rrLogin := httptest.NewRecorder()
	mux.ServeHTTP(rrLogin, reqLogin)

	if rrLogin.Code != http.StatusOK {
		t.Fatalf("expected 200 for login view, got %d", rrLogin.Code)
	}
	if !strings.Contains(rrLogin.Body.String(), "MoveX Admin Login") {
		t.Errorf("expected login page to contain 'MoveX Admin Login', got %q", rrLogin.Body.String())
	}

	// 2. Unauthenticated GET /admin/ -> 303 Redirect to /admin/login
	reqDashUnauth := httptest.NewRequest(http.MethodGet, "/admin/", nil)
	rrDashUnauth := httptest.NewRecorder()
	mux.ServeHTTP(rrDashUnauth, reqDashUnauth)

	if rrDashUnauth.Code != http.StatusSeeOther || rrDashUnauth.Header().Get("Location") != "/admin/login" {
		t.Fatalf("expected 303 redirect to /admin/login, got %d", rrDashUnauth.Code)
	}

	// 3. Authenticated GET /admin/ -> 200 OK with SVG Chart
	cookie := getAuthCookie(adminMgr)
	reqDashAuth := httptest.NewRequest(http.MethodGet, "/admin/?days=7", nil)
	reqDashAuth.AddCookie(cookie)
	rrDashAuth := httptest.NewRecorder()
	mux.ServeHTTP(rrDashAuth, reqDashAuth)

	if rrDashAuth.Code != http.StatusOK {
		t.Fatalf("expected 200 for authenticated dashboard, got %d", rrDashAuth.Code)
	}
	bodyStr := rrDashAuth.Body.String()
	if !strings.Contains(bodyStr, "<svg") || !strings.Contains(bodyStr, "User Growth Analytics") {
		t.Errorf("expected dashboard to contain inline SVG chart")
	}
	if !strings.Contains(bodyStr, "Total Content") {
		t.Errorf("expected dashboard to contain stat cards")
	}
}

func TestAdminMovieLifecycle(t *testing.T) {
	mux, _, adminMgr, mRepo := setupAdminTest(t)
	cookie := getAuthCookie(adminMgr)
	csrfToken := adminMgr.GenerateCSRFToken("admin-test-uid")

	// 1. GET /admin/movies/new -> 200 OK
	reqNew := httptest.NewRequest(http.MethodGet, "/admin/movies/new", nil)
	reqNew.AddCookie(cookie)
	rrNew := httptest.NewRecorder()
	mux.ServeHTTP(rrNew, reqNew)

	if rrNew.Code != http.StatusOK {
		t.Fatalf("expected 200 for new movie form, got %d", rrNew.Code)
	}

	// 2. POST /admin/movies/save (Create new Movie)
	form := url.Values{
		"csrf_token":           {csrfToken},
		"title":                {"Spider-Man: Across the Spider-Verse"},
		"content_type":         {"movie"},
		"year":                 {"2023"},
		"rating":               {"8.7"},
		"genres":               {"Animation, Action, Sci-Fi"},
		"poster_url":           {"https://image.tmdb.org/t/p/w500/poster.jpg"},
		"backdrop_url":         {"https://image.tmdb.org/t/p/original/backdrop.jpg"},
		"is_featured":          {"1"},
		"stream_url[]":         {"https://player.videasy.net/embed/movie/spider"},
		"stream_label[]":       {"Fast Video"},
		"stream_server_type[]": {""}, // Blank to test auto-detection
		"download_quality[]":   {"1080p"},
		"download_size[]":      {"2.4 GB"},
		"download_url[]":       {"https://download.example.com/spider.mkv"},
		"download_label[]":     {"Mirror 1"},
	}

	reqSave := httptest.NewRequest(http.MethodPost, "/admin/movies/save", strings.NewReader(form.Encode()))
	reqSave.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	reqSave.AddCookie(cookie)
	rrSave := httptest.NewRecorder()
	mux.ServeHTTP(rrSave, reqSave)

	if rrSave.Code != http.StatusSeeOther {
		t.Fatalf("expected 303 redirect after save, got %d", rrSave.Code)
	}

	// Verify Movie in DB
	list, total, err := mRepo.ListMovies(repo.MovieFilter{Query: "Spider-Man"})
	if err != nil || total != 1 || len(list) != 1 {
		t.Fatalf("expected movie to be saved in db, total=%d, err=%v", total, err)
	}
	savedMovie := list[0]

	// 3. GET /admin/movies/{id}/edit -> 200 OK populated
	reqEdit := httptest.NewRequest(http.MethodGet, "/admin/movies/"+savedMovie.ID+"/edit", nil)
	reqEdit.AddCookie(cookie)
	rrEdit := httptest.NewRecorder()
	mux.ServeHTTP(rrEdit, reqEdit)

	if rrEdit.Code != http.StatusOK {
		t.Fatalf("expected 200 for edit form, got %d", rrEdit.Code)
	}
	if !strings.Contains(rrEdit.Body.String(), "Spider-Man") {
		t.Errorf("expected edit form to contain movie title")
	}

	// 4. POST /admin/movies/{id}/delete -> Deletes movie
	reqDel := httptest.NewRequest(http.MethodPost, "/admin/movies/"+savedMovie.ID+"/delete", nil)
	reqDel.Header.Set("X-CSRF-Token", csrfToken)
	reqDel.AddCookie(cookie)
	rrDel := httptest.NewRecorder()
	mux.ServeHTTP(rrDel, reqDel)

	if rrDel.Code != http.StatusSeeOther {
		t.Fatalf("expected 303 redirect after delete, got %d", rrDel.Code)
	}

	// Verify deletion
	_, err = mRepo.GetMovie(savedMovie.ID)
	if err == nil {
		t.Errorf("expected movie to be deleted from DB")
	}
}
