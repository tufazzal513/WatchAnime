package admin

import (
	"net/http"

	"movex/internal/api"
	"movex/internal/auth"
)

// RegisterAdminRoutes mounts all SSR admin panel routes onto the ServeMux.
func RegisterAdminRoutes(mux *http.ServeMux, h *AdminHandler, adminMgr *auth.AdminManager) {
	// Public Login Routes
	mux.HandleFunc("GET /admin/login", h.HandleLoginView)
	mux.HandleFunc("POST /admin/login", h.HandleLoginPost)
	mux.HandleFunc("POST /admin/logout", h.HandleLogout)

	// Protected Routes (Session & CSRF guard)
	requireAdmin := api.RequireAdminAuthMiddleware(adminMgr)

	// Dashboard
	mux.Handle("GET /admin/", requireAdmin(http.HandlerFunc(h.HandleDashboard)))

	// Movies Management
	mux.Handle("GET /admin/movies", requireAdmin(http.HandlerFunc(h.HandleListMovies)))
	mux.Handle("GET /admin/movies/new", requireAdmin(http.HandlerFunc(h.HandleNewMovie)))
	mux.Handle("GET /admin/movies/{id}/edit", requireAdmin(http.HandlerFunc(h.HandleEditMovie)))
	mux.Handle("POST /admin/movies/save", requireAdmin(http.HandlerFunc(h.HandleSaveMovie)))
	mux.Handle("POST /admin/movies/{id}/delete", requireAdmin(http.HandlerFunc(h.HandleDeleteMovie)))

	// Categories
	mux.Handle("GET /admin/categories", requireAdmin(http.HandlerFunc(h.HandleListCategories)))
	mux.Handle("POST /admin/categories/save", requireAdmin(http.HandlerFunc(h.HandleSaveCategory)))
	mux.Handle("POST /admin/categories/{id}/delete", requireAdmin(http.HandlerFunc(h.HandleDeleteCategory)))

	// Banners
	mux.Handle("GET /admin/banners", requireAdmin(http.HandlerFunc(h.HandleListBanners)))
	mux.Handle("POST /admin/banners/save", requireAdmin(http.HandlerFunc(h.HandleSaveBanner)))
	mux.Handle("POST /admin/banners/{id}/delete", requireAdmin(http.HandlerFunc(h.HandleDeleteBanner)))

	// Users
	mux.Handle("GET /admin/users", requireAdmin(http.HandlerFunc(h.HandleListUsers)))
	mux.Handle("POST /admin/users/{uid}/status", requireAdmin(http.HandlerFunc(h.HandleUpdateUserStatus)))
	mux.Handle("POST /admin/users/{uid}/delete", requireAdmin(http.HandlerFunc(h.HandleDeleteUserData)))

	// Broken Links
	mux.Handle("GET /admin/broken-links", requireAdmin(http.HandlerFunc(h.HandleListBrokenLinks)))
	mux.Handle("POST /admin/broken-links/{id}/status", requireAdmin(http.HandlerFunc(h.HandleUpdateBrokenLinkStatus)))
	mux.Handle("POST /admin/broken-links/{id}/delete", requireAdmin(http.HandlerFunc(h.HandleDeleteBrokenLink)))

	// Settings & Announcements
	mux.Handle("GET /admin/settings", requireAdmin(http.HandlerFunc(h.HandleSettingsView)))
	mux.Handle("POST /admin/settings/save", requireAdmin(http.HandlerFunc(h.HandleSaveSettings)))
	mux.Handle("POST /admin/settings/socials/save", requireAdmin(http.HandlerFunc(h.HandleSaveSocial)))
	mux.Handle("POST /admin/settings/socials/{id}/delete", requireAdmin(http.HandlerFunc(h.HandleDeleteSocial)))
	mux.Handle("POST /admin/settings/notify", requireAdmin(http.HandlerFunc(h.HandleNotify)))
	mux.Handle("POST /admin/settings/notifications/{id}/delete", requireAdmin(http.HandlerFunc(h.HandleDeleteNotification)))

	// Server & Workers Cluster
	mux.Handle("GET /admin/server", requireAdmin(http.HandlerFunc(h.HandleServerView)))
	mux.Handle("POST /admin/server/workers/add", requireAdmin(http.HandlerFunc(h.HandleAddWorker)))
	mux.Handle("POST /admin/server/workers/{id}/delete", requireAdmin(http.HandlerFunc(h.HandleDeleteWorker)))
	mux.Handle("POST /admin/server/backup", requireAdmin(http.HandlerFunc(h.HandleManualBackup)))
}
