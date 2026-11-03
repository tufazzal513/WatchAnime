package api

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"movex/internal/auth"
	"movex/internal/config"
	"movex/internal/repo"
)

const (
	UserClaimsKey = auth.UserClaimsKey
	AdminUIDKey   = auth.AdminUIDKey
)

// -----------------------------------------------------------------------------
// Logging & Panic Recovery Middleware
// -----------------------------------------------------------------------------

type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func (r *statusRecorder) Write(b []byte) (int, error) {
	if r.status == 0 {
		r.status = http.StatusOK
	}
	n, err := r.ResponseWriter.Write(b)
	r.bytes += n
	return n, err
}

func LoggingAndRecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w}

		defer func() {
			if recErr := recover(); recErr != nil {
				slog.Error("panic recovered in HTTP handler",
					"err", recErr,
					"path", r.URL.Path,
					"method", r.Method,
				)
				if rec.status == 0 {
					w.Header().Set("Content-Type", "application/json; charset=utf-8")
					w.WriteHeader(http.StatusInternalServerError)
					_ = json.NewEncoder(w).Encode(map[string]any{
						"error": "internal_server_error",
					})
				}
			}
		}()

		next.ServeHTTP(rec, r)

		duration := time.Since(start)
		if rec.status == 0 {
			rec.status = http.StatusOK
		}

		// Don't clutter logs with successful high-frequency health probes
		if r.URL.Path == "/health" && rec.status == http.StatusOK {
			return
		}

		slog.Info("http request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rec.status,
			"bytes", rec.bytes,
			"duration_ms", duration.Milliseconds(),
			"ip", ClientIP(r),
		)
	})
}

// -----------------------------------------------------------------------------
// Security Headers Middleware
// -----------------------------------------------------------------------------

func SecurityHeadersMiddleware(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := w.Header()
			h.Set("X-Content-Type-Options", "nosniff")
			h.Set("X-Frame-Options", "DENY")
			h.Set("Referrer-Policy", "strict-origin-when-cross-origin")

			// Extra strict policies for Admin SSR panel
			if strings.HasPrefix(r.URL.Path, "/admin") {
				h.Set("Cache-Control", "no-store, no-cache, must-revalidate, private")
				h.Set("Pragma", "no-cache")
				h.Set("Content-Security-Policy", "default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' https: data:; img-src 'self' data: https:; frame-ancestors 'self' https:;")
			}

			next.ServeHTTP(w, r)
		})
	}
}

// -----------------------------------------------------------------------------
// CORS Middleware (User API only)
// -----------------------------------------------------------------------------

func CORSMiddleware(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Do NOT enable CORS on admin routes
			if strings.HasPrefix(r.URL.Path, "/admin") {
				next.ServeHTTP(w, r)
				return
			}

			origin := r.Header.Get("Origin")
			allowedOrigin := ""

			if len(cfg.AllowedOrigins) == 1 && cfg.AllowedOrigins[0] == "*" {
				allowedOrigin = "*"
			} else if origin != "" {
				for _, o := range cfg.AllowedOrigins {
					if o == "*" || o == origin {
						allowedOrigin = origin
						break
					}
				}
			}

			if allowedOrigin != "" {
				w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, If-None-Match, X-Worker-Key, X-CSRF-Token")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
				w.Header().Set("Access-Control-Expose-Headers", "ETag, Content-Disposition")
				w.Header().Set("Access-Control-Max-Age", "86400")
				w.Header().Set("Vary", "Origin, Accept-Encoding")
			}

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// -----------------------------------------------------------------------------
// Gzip & ETag Middleware (Compresses & sets ETag for caching)
// -----------------------------------------------------------------------------

type bufferedResponseWriter struct {
	http.ResponseWriter
	buf        bytes.Buffer
	statusCode int
}

func (b *bufferedResponseWriter) WriteHeader(code int) {
	b.statusCode = code
}

func (b *bufferedResponseWriter) Write(p []byte) (int, error) {
	return b.buf.Write(p)
}

func GzipAndETagMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Only buffer GET and HEAD requests for ETag and caching
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			next.ServeHTTP(w, r)
			return
		}

		bw := &bufferedResponseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}

		next.ServeHTTP(bw, r)

		bodyBytes := bw.buf.Bytes()

		// Generate ETag if status is 200 OK
		if bw.statusCode == http.StatusOK && len(bodyBytes) > 0 {
			h := sha256.Sum256(bodyBytes)
			etag := `"` + hex.EncodeToString(h[:16]) + `"`
			w.Header().Set("ETag", etag)

			if match := r.Header.Get("If-None-Match"); match != "" {
				if match == etag || match == "W/"+etag {
					w.WriteHeader(http.StatusNotModified)
					return
				}
			}
		}

		// Check if client accepts gzip and content size > 512 bytes
		acceptsGzip := strings.Contains(r.Header.Get("Accept-Encoding"), "gzip")
		if acceptsGzip && len(bodyBytes) > 512 {
			w.Header().Set("Content-Encoding", "gzip")
			w.Header().Set("Vary", "Accept-Encoding")
			w.WriteHeader(bw.statusCode)

			gz := gzip.NewWriter(w)
			_, _ = gz.Write(bodyBytes)
			_ = gz.Close()
			return
		}

		w.WriteHeader(bw.statusCode)
		_, _ = w.Write(bodyBytes)
	})
}

// -----------------------------------------------------------------------------
// Rate Limiter
// -----------------------------------------------------------------------------

type entry struct {
	count int
	reset time.Time
}

type RateLimiter struct {
	mu      sync.Mutex
	entries map[string]*entry
	maxReq  int
	window  time.Duration
}

func NewRateLimiter(maxReq int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		entries: make(map[string]*entry),
		maxReq:  maxReq,
		window:  window,
	}
	// Background cleanup of expired buckets
	go func() {
		ticker := time.NewTicker(window * 2)
		for range ticker.C {
			rl.mu.Lock()
			now := time.Now()
			for k, v := range rl.entries {
				if now.After(v.reset) {
					delete(rl.entries, k)
				}
			}
			rl.mu.Unlock()
		}
	}()
	return rl
}

func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	e, found := rl.entries[key]
	if !found || now.After(e.reset) {
		rl.entries[key] = &entry{
			count: 1,
			reset: now.Add(rl.window),
		}
		return true
	}

	if e.count >= rl.maxReq {
		return false
	}
	e.count++
	return true
}

// -----------------------------------------------------------------------------
// User Authentication Middleware
// -----------------------------------------------------------------------------

func RequireUserAuthMiddleware(verifier *auth.TokenVerifier, userRepo *repo.UserRepo) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				http.Error(w, `{"error":"unauthorized","message":"missing or invalid authorization header"}`, http.StatusUnauthorized)
				return
			}

			token := strings.TrimPrefix(authHeader, "Bearer ")
			claims, err := verifier.VerifyToken(token)
			if err != nil {
				http.Error(w, fmt.Sprintf(`{"error":"invalid_token","message":%q}`, err.Error()), http.StatusUnauthorized)
				return
			}

			// Verify user account status in database
			if userRepo != nil {
				u, err := userRepo.GetUser(claims.UID)
				if err == nil && u != nil {
					if u.Status == "frozen" || u.Status == "deleted" {
						http.Error(w, `{"error":"forbidden","message":"user account is blocked or deleted"}`, http.StatusForbidden)
						return
					}
				}
			}

			ctx := context.WithValue(r.Context(), UserClaimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// -----------------------------------------------------------------------------
// Admin Authentication Middleware (for SSR Admin Panel)
// -----------------------------------------------------------------------------

func RequireAdminAuthMiddleware(adminMgr *auth.AdminManager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Login and asset paths are public
			if r.URL.Path == "/admin/login" || strings.HasPrefix(r.URL.Path, "/admin/static/") {
				next.ServeHTTP(w, r)
				return
			}

			uid, err := adminMgr.GetAdminSession(r)
			if err != nil {
				// If HTMX request or API call
				if r.Header.Get("HX-Request") == "true" {
					w.Header().Set("HX-Redirect", "/admin/login")
					http.Error(w, "unauthorized", http.StatusUnauthorized)
					return
				}
				http.Redirect(w, r, "/admin/login", http.StatusSeeOther)
				return
			}

			// Validate CSRF token for mutations (POST, PUT, DELETE, PATCH)
			if r.Method == http.MethodPost || r.Method == http.MethodPut || r.Method == http.MethodDelete || r.Method == http.MethodPatch {
				csrfToken := r.Header.Get("X-CSRF-Token")
				if csrfToken == "" {
					csrfToken = r.FormValue("csrf_token")
				}
				if !adminMgr.ValidateCSRFToken(uid, csrfToken) {
					http.Error(w, "CSRF token missing or invalid", http.StatusForbidden)
					return
				}
			}

			ctx := context.WithValue(r.Context(), AdminUIDKey, uid)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// ClientIP extracts remote IP considering X-Forwarded-For if trusted.
func ClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}
