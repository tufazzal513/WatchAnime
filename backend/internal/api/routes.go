package api

import (
	"net/http"

	"movex/internal/auth"
	"movex/internal/config"
	"movex/internal/repo"
	"movex/internal/sync"
)

// RegisterUserAPIRoutes mounts all user JSON API endpoints onto the ServeMux.
func RegisterUserAPIRoutes(
	mux *http.ServeMux,
	cfg *config.Config,
	userAPI *UserAPIHandler,
	serverHandler *ServerHandler,
	verifier *auth.TokenVerifier,
	userRepo *repo.UserRepo,
) {
	// Public Health & Discovery
	mux.HandleFunc("GET /health", serverHandler.HandleHealth)
	mux.HandleFunc("GET /servers", serverHandler.HandleServers)
	mux.HandleFunc("GET /api/health", serverHandler.HandleHealth)
	mux.HandleFunc("GET /api/servers", serverHandler.HandleServers)
	mux.HandleFunc("GET /api/v1/health", serverHandler.HandleHealth)
	mux.HandleFunc("GET /api/v1/servers", serverHandler.HandleServers)

	// Replication Changes for Worker Nodes
	syncHandler := sync.NewHandler(cfg, userRepo)
	mux.HandleFunc("GET /api/v1/sync/changes", syncHandler.HandleChanges)

	// Frontend Database Compatibility Router (/api/db/*)
	compatAPI := NewCompatAPIHandler(cfg, userAPI.movieRepo, userAPI.catalogRepo, userRepo, userAPI.presence)
	mux.HandleFunc("/api/db/", compatAPI.HandleDB)

	// Public Settings & Password Reset
	mux.HandleFunc("GET /api/v1/settings/public", userAPI.HandlePublicSettings)
	mux.HandleFunc("POST /api/v1/auth/password-reset", userAPI.HandlePasswordReset)

	// Auth Guarded API Routes
	requireAuth := RequireUserAuthMiddleware(verifier, userRepo)

	// Movies Catalog
	mux.Handle("GET /api/v1/movies", requireAuth(http.HandlerFunc(userAPI.HandleListMovies)))
	mux.Handle("GET /api/v1/movies/{id}", requireAuth(http.HandlerFunc(userAPI.HandleGetMovie)))
	mux.Handle("POST /api/v1/movies/{id}/view", requireAuth(http.HandlerFunc(userAPI.HandleIncrementMovieViews)))

	// Taxonomy, Banners, Socials & Notifications
	mux.Handle("GET /api/v1/categories", requireAuth(http.HandlerFunc(userAPI.HandleListCategories)))
	mux.Handle("GET /api/v1/banners", requireAuth(http.HandlerFunc(userAPI.HandleListBanners)))
	mux.Handle("GET /api/v1/social-links", requireAuth(http.HandlerFunc(userAPI.HandleListSocialLinks)))
	mux.Handle("GET /api/v1/notifications", requireAuth(http.HandlerFunc(userAPI.HandleListNotifications)))

	// Search
	mux.Handle("GET /api/v1/search/suggest", requireAuth(http.HandlerFunc(userAPI.HandleSearchSuggest)))
	mux.Handle("POST /api/v1/search/hit", requireAuth(http.HandlerFunc(userAPI.HandleSearchHit)))

	// User Profile
	mux.Handle("GET /api/v1/me", requireAuth(http.HandlerFunc(userAPI.HandleGetMe)))
	mux.Handle("PUT /api/v1/me", requireAuth(http.HandlerFunc(userAPI.HandleUpdateMe)))

	// My List
	mux.Handle("GET /api/v1/me/list", requireAuth(http.HandlerFunc(userAPI.HandleGetMyList)))
	mux.Handle("PUT /api/v1/me/list/{movieId}", requireAuth(http.HandlerFunc(userAPI.HandleAddToMyList)))
	mux.Handle("DELETE /api/v1/me/list/{movieId}", requireAuth(http.HandlerFunc(userAPI.HandleRemoveFromMyList)))

	// Watch Progress
	mux.Handle("GET /api/v1/me/progress", requireAuth(http.HandlerFunc(userAPI.HandleGetProgress)))
	mux.Handle("PUT /api/v1/me/progress/{movieId}", requireAuth(http.HandlerFunc(userAPI.HandleUpdateProgress)))

	// Presence (in-memory heartbeats)
	mux.Handle("POST /api/v1/presence", requireAuth(http.HandlerFunc(userAPI.HandlePresence)))

	// Broken link reporting
	mux.Handle("POST /api/v1/broken-links", requireAuth(http.HandlerFunc(userAPI.HandleBrokenLink)))

	// Client errors logging
	mux.Handle("POST /api/v1/errors", requireAuth(http.HandlerFunc(userAPI.HandleErrorLog)))
}
