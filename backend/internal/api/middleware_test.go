package api

import (
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"movex/internal/auth"
	"movex/internal/config"
	"movex/internal/db"
	"movex/internal/repo"
)

func TestPanicRecovery(t *testing.T) {
	handler := LoggingAndRecoveryMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("something went critically wrong")
	}))

	req := httptest.NewRequest(http.MethodGet, "/test-panic", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 status on panic, got %d", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "internal_server_error") {
		t.Errorf("expected json error response, got %s", rr.Body.String())
	}
}

func TestCORS(t *testing.T) {
	cfg := &config.Config{
		AllowedOrigins: []string{"https://frontend.movex.app"},
	}
	cors := CORSMiddleware(cfg)

	// Preflight OPTIONS
	handler := cors(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/movies", nil)
	req.Header.Set("Origin", "https://frontend.movex.app")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Errorf("expected 204 for OPTIONS, got %d", rr.Code)
	}
	if rr.Header().Get("Access-Control-Allow-Origin") != "https://frontend.movex.app" {
		t.Errorf("expected allow origin header")
	}

	// Origin not allowed
	reqBad := httptest.NewRequest(http.MethodGet, "/api/v1/movies", nil)
	reqBad.Header.Set("Origin", "https://malicious.site")
	rrBad := httptest.NewRecorder()

	handler.ServeHTTP(rrBad, reqBad)
	if rrBad.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("expected no allow origin for disallowed site")
	}

	// Admin route must NOT get CORS header
	reqAdmin := httptest.NewRequest(http.MethodGet, "/admin/dashboard", nil)
	reqAdmin.Header.Set("Origin", "https://frontend.movex.app")
	rrAdmin := httptest.NewRecorder()

	handler.ServeHTTP(rrAdmin, reqAdmin)
	if rrAdmin.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("admin route must never output CORS headers")
	}
}

func TestGzipAndETag(t *testing.T) {
	largeBody := strings.Repeat("MoveX Streaming High Performance Platform! ", 50) // > 512 bytes

	handler := GzipAndETagMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(largeBody))
	}))

	// 1. Initial GET with gzip
	req := httptest.NewRequest(http.MethodGet, "/api/v1/movies", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rr.Code)
	}
	etag := rr.Header().Get("ETag")
	if etag == "" {
		t.Fatalf("expected ETag header to be set")
	}
	if rr.Header().Get("Content-Encoding") != "gzip" {
		t.Errorf("expected gzip content encoding")
	}

	// Verify gzip decompression
	gzReader, err := gzip.NewReader(rr.Body)
	if err != nil {
		t.Fatalf("failed to create gzip reader: %v", err)
	}
	decompressed, _ := io.ReadAll(gzReader)
	if string(decompressed) != largeBody {
		t.Errorf("decompressed content does not match original")
	}

	// 2. Conditional GET with If-None-Match -> Expect 304 Not Modified
	req304 := httptest.NewRequest(http.MethodGet, "/api/v1/movies", nil)
	req304.Header.Set("If-None-Match", etag)
	rr304 := httptest.NewRecorder()

	handler.ServeHTTP(rr304, req304)

	if rr304.Code != http.StatusNotModified {
		t.Errorf("expected 304 Not Modified, got %d", rr304.Code)
	}
	if rr304.Body.Len() > 0 {
		t.Errorf("expected empty body for 304 response, got %d bytes", rr304.Body.Len())
	}
}

func TestRateLimiter(t *testing.T) {
	rl := NewRateLimiter(3, 100*time.Millisecond)

	ip := "192.168.1.1"
	if !rl.Allow(ip) {
		t.Errorf("request 1 should be allowed")
	}
	if !rl.Allow(ip) {
		t.Errorf("request 2 should be allowed")
	}
	if !rl.Allow(ip) {
		t.Errorf("request 3 should be allowed")
	}
	if rl.Allow(ip) {
		t.Errorf("request 4 should be rejected by rate limiter")
	}

	// After window expires, should allow again
	time.Sleep(120 * time.Millisecond)
	if !rl.Allow(ip) {
		t.Errorf("request after window should be allowed")
	}
}

func TestRequireUserAuth(t *testing.T) {
	database, _ := db.Open(":memory:")
	uRepo := repo.NewUserRepo(database)
	verifier := auth.NewTokenVerifier("test-proj", true)

	// Save a frozen user in DB
	_ = uRepo.UpsertUser(&repo.User{UID: "frozen-uid", Status: "frozen"})
	// Save an active user in DB
	_ = uRepo.UpsertUser(&repo.User{UID: "active-uid", Status: "active"})

	middleware := RequireUserAuthMiddleware(verifier, uRepo)
	var capturedClaims *auth.TokenClaims

	dummyHandler := middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if c, ok := r.Context().Value(UserClaimsKey).(*auth.TokenClaims); ok {
			capturedClaims = c
		}
		w.WriteHeader(http.StatusOK)
	}))

	// 1. Missing Authorization header -> 401
	reqNoAuth := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	rrNoAuth := httptest.NewRecorder()
	dummyHandler.ServeHTTP(rrNoAuth, reqNoAuth)
	if rrNoAuth.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for missing auth, got %d", rrNoAuth.Code)
	}

	// 2. Frozen user -> 403 Forbidden
	reqFrozen := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	reqFrozen.Header.Set("Authorization", "Bearer dev:frozen-uid")
	rrFrozen := httptest.NewRecorder()
	dummyHandler.ServeHTTP(rrFrozen, reqFrozen)
	if rrFrozen.Code != http.StatusForbidden {
		t.Errorf("expected 403 for frozen user, got %d", rrFrozen.Code)
	}

	// 3. Active user -> 200 OK
	reqActive := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	reqActive.Header.Set("Authorization", "Bearer dev:active-uid")
	rrActive := httptest.NewRecorder()
	dummyHandler.ServeHTTP(rrActive, reqActive)
	if rrActive.Code != http.StatusOK {
		t.Fatalf("expected 200 for active user, got %d", rrActive.Code)
	}
	if capturedClaims == nil || capturedClaims.UID != "active-uid" {
		t.Errorf("expected context claims with active-uid")
	}
}

func TestRequireAdminAuth(t *testing.T) {
	cfg := &config.Config{
		Role:          "main",
		AdminUIDs:     []string{"super-admin"},
		SessionSecret: []byte("very-secure-32-byte-secret-for-hmac!"),
		CookieSecure:  false,
	}
	adminMgr := auth.NewAdminManager(cfg)
	middleware := RequireAdminAuthMiddleware(adminMgr)

	protectedHandler := middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// 1. Unauthenticated browser GET -> redirects to /admin/login (303)
	reqNoAuth := httptest.NewRequest(http.MethodGet, "/admin/dashboard", nil)
	rrNoAuth := httptest.NewRecorder()
	protectedHandler.ServeHTTP(rrNoAuth, reqNoAuth)
	if rrNoAuth.Code != http.StatusSeeOther || rrNoAuth.Header().Get("Location") != "/admin/login" {
		t.Errorf("expected redirect to /admin/login, got status %d, location %s", rrNoAuth.Code, rrNoAuth.Header().Get("Location"))
	}

	// 2. Unauthenticated HTMX request -> 401 with HX-Redirect header
	reqHTMX := httptest.NewRequest(http.MethodGet, "/admin/dashboard", nil)
	reqHTMX.Header.Set("HX-Request", "true")
	rrHTMX := httptest.NewRecorder()
	protectedHandler.ServeHTTP(rrHTMX, reqHTMX)
	if rrHTMX.Code != http.StatusUnauthorized || rrHTMX.Header().Get("HX-Redirect") != "/admin/login" {
		t.Errorf("expected 401 with HX-Redirect, got status %d", rrHTMX.Code)
	}

	// 3. Authenticated session GET -> 200 OK
	recCookie := httptest.NewRecorder()
	adminMgr.SetAdminSession(recCookie, "super-admin")
	adminCookie := recCookie.Result().Cookies()[0]

	reqAuth := httptest.NewRequest(http.MethodGet, "/admin/dashboard", nil)
	reqAuth.AddCookie(adminCookie)
	rrAuth := httptest.NewRecorder()
	protectedHandler.ServeHTTP(rrAuth, reqAuth)
	if rrAuth.Code != http.StatusOK {
		t.Errorf("expected 200 for authenticated admin GET, got %d", rrAuth.Code)
	}

	// 4. Authenticated POST without CSRF token -> 403 Forbidden
	reqPostNoCSRF := httptest.NewRequest(http.MethodPost, "/admin/movies/delete", nil)
	reqPostNoCSRF.AddCookie(adminCookie)
	rrPostNoCSRF := httptest.NewRecorder()
	protectedHandler.ServeHTTP(rrPostNoCSRF, reqPostNoCSRF)
	if rrPostNoCSRF.Code != http.StatusForbidden {
		t.Errorf("expected 403 for POST without CSRF token, got %d", rrPostNoCSRF.Code)
	}

	// 5. Authenticated POST with valid CSRF token -> 200 OK
	csrf := adminMgr.GenerateCSRFToken("super-admin")
	reqPostCSRF := httptest.NewRequest(http.MethodPost, "/admin/movies/delete", nil)
	reqPostCSRF.AddCookie(adminCookie)
	reqPostCSRF.Header.Set("X-CSRF-Token", csrf)
	rrPostCSRF := httptest.NewRecorder()
	protectedHandler.ServeHTTP(rrPostCSRF, reqPostCSRF)
	if rrPostCSRF.Code != http.StatusOK {
		t.Errorf("expected 200 for POST with valid CSRF token, got %d", rrPostCSRF.Code)
	}
}
