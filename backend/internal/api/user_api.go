package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"movex/internal/auth"
	"movex/internal/config"
	"movex/internal/presence"
	"movex/internal/repo"
)

type UserAPIHandler struct {
	cfg         *config.Config
	movieRepo   *repo.MovieRepo
	catalogRepo *repo.CatalogRepo
	userRepo    *repo.UserRepo
	presence    *presence.Tracker
	rateLimiter *RateLimiter
	httpClient  *http.Client
}

func NewUserAPIHandler(
	cfg *config.Config,
	mRepo *repo.MovieRepo,
	cRepo *repo.CatalogRepo,
	uRepo *repo.UserRepo,
	pTracker *presence.Tracker,
) *UserAPIHandler {
	return &UserAPIHandler{
		cfg:         cfg,
		movieRepo:   mRepo,
		catalogRepo: cRepo,
		userRepo:    uRepo,
		presence:    pTracker,
		rateLimiter: NewRateLimiter(60, 1*time.Minute), // 60 write requests per minute per IP/UID
		httpClient:  &http.Client{Timeout: 10 * time.Second},
	}
}

// -----------------------------------------------------------------------------
// Helper Methods
// -----------------------------------------------------------------------------

func (h *UserAPIHandler) getAuthenticatedClaims(r *http.Request) *auth.TokenClaims {
	claims, _ := r.Context().Value(UserClaimsKey).(*auth.TokenClaims)
	return claims
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, map[string]any{
		"error":   code,
		"message": msg,
	})
}

// -----------------------------------------------------------------------------
// Public Settings
// -----------------------------------------------------------------------------

func (h *UserAPIHandler) HandlePublicSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.catalogRepo.GetAllPublicSettings()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"settings": settings,
	})
}

// -----------------------------------------------------------------------------
// Movies Catalog API
// -----------------------------------------------------------------------------

func (h *UserAPIHandler) HandleListMovies(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	offset, _ := strconv.Atoi(q.Get("offset"))
	if offset < 0 {
		offset = 0
	}

	limit, _ := strconv.Atoi(q.Get("limit"))
	if limit <= 0 {
		if q.Get("q") != "" {
			limit = 20 // Default 20 for search results
		} else {
			limit = 24 // Default 24 for catalog browsing
		}
	}
	if limit > 100 {
		limit = 100
	}

	year, _ := strconv.Atoi(q.Get("year"))

	filter := repo.MovieFilter{
		Query:       q.Get("q"),
		ContentType: q.Get("type"),
		Category:    q.Get("category"),
		Industry:    q.Get("industry"),
		Language:    q.Get("language"),
		Year:        year,
		SortBy:      q.Get("sort"),
		Offset:      offset,
		Limit:       limit,
	}

	// Normal users never see private movies
	isPrivate := false
	filter.IsPrivate = &isPrivate

	if q.Get("featured") == "1" {
		featured := true
		filter.IsFeatured = &featured
	}
	if q.Get("upcoming") == "1" {
		upcoming := true
		filter.IsUpcoming = &upcoming
	}

	movies, total, err := h.movieRepo.ListMovies(filter)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"movies": movies,
		"total":  total,
		"offset": offset,
		"limit":  limit,
	})
}

func (h *UserAPIHandler) HandleGetMovie(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "invalid_id", "Movie ID is required")
		return
	}

	movie, err := h.movieRepo.GetMovieFull(id)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Movie not found")
		return
	}

	if movie.IsPrivate {
		writeError(w, http.StatusNotFound, "not_found", "Movie not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"movie": movie,
	})
}

func (h *UserAPIHandler) HandleIncrementMovieViews(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "invalid_id", "Movie ID is required")
		return
	}

	claims := h.getAuthenticatedClaims(r)
	rateKey := "view:" + id + ":" + ClientIP(r)
	if claims != nil {
		rateKey = "view:" + id + ":" + claims.UID
	}

	if !h.rateLimiter.Allow(rateKey) {
		writeError(w, http.StatusTooManyRequests, "rate_limited", "Too many view events")
		return
	}

	if err := h.movieRepo.IncrementViews(id); err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
	})
}

// -----------------------------------------------------------------------------
// Catalog Sub-resources: Categories, Banners, Socials, Notifications
// -----------------------------------------------------------------------------

func (h *UserAPIHandler) HandleListCategories(w http.ResponseWriter, r *http.Request) {
	cats, err := h.catalogRepo.ListCategories()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"categories": cats,
	})
}

func (h *UserAPIHandler) HandleListBanners(w http.ResponseWriter, r *http.Request) {
	banners, err := h.catalogRepo.ListBanners(true) // active only
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"banners": banners,
	})
}

func (h *UserAPIHandler) HandleListSocialLinks(w http.ResponseWriter, r *http.Request) {
	links, err := h.catalogRepo.ListSocialLinks()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"socialLinks": links,
	})
}

func (h *UserAPIHandler) HandleListNotifications(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 20
	}
	notes, err := h.catalogRepo.ListNotifications(limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"notifications": notes,
	})
}

// -----------------------------------------------------------------------------
// Search Suggestions & Hits
// -----------------------------------------------------------------------------

func (h *UserAPIHandler) HandleSearchSuggest(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	suggestions, err := h.userRepo.GetSearchSuggestions(q, 10)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"suggestions": suggestions,
	})
}

func (h *UserAPIHandler) HandleSearchHit(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Term string `json:"term"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request payload")
		return
	}

	term := strings.TrimSpace(body.Term)
	if len(term) >= 2 && len(term) <= 50 {
		_ = h.userRepo.RecordSearchHit(term)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
	})
}

// -----------------------------------------------------------------------------
// User Profile: /me
// -----------------------------------------------------------------------------

func (h *UserAPIHandler) HandleGetMe(w http.ResponseWriter, r *http.Request) {
	claims := h.getAuthenticatedClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	user, err := h.userRepo.GetUser(claims.UID)
	if err != nil || user == nil {
		// Auto-provision initial user record from verified Firebase claims
		user = &repo.User{
			UID:         claims.UID,
			Email:       claims.Email,
			Name:        claims.Name,
			Avatar:      claims.Picture,
			Status:      "active",
			CreatedAt:   time.Now().UnixMilli(),
			LastSeen:    time.Now().UnixMilli(),
			LastLoginAt: time.Now().UnixMilli(),
		}
		_ = h.userRepo.UpsertUser(user)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"user": user,
	})
}

func (h *UserAPIHandler) HandleUpdateMe(w http.ResponseWriter, r *http.Request) {
	claims := h.getAuthenticatedClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	var body struct {
		Name   string `json:"name"`
		Avatar string `json:"avatar"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	user, err := h.userRepo.GetUser(claims.UID)
	if err != nil || user == nil {
		user = &repo.User{
			UID:       claims.UID,
			Email:     claims.Email,
			Status:    "active",
			CreatedAt: time.Now().UnixMilli(),
		}
	}

	if body.Name != "" {
		user.Name = strings.TrimSpace(body.Name)
	}
	if body.Avatar != "" {
		user.Avatar = strings.TrimSpace(body.Avatar)
	}
	user.LastSeen = time.Now().UnixMilli()

	if err := h.userRepo.UpsertUser(user); err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"user": user,
	})
}

// -----------------------------------------------------------------------------
// My List
// -----------------------------------------------------------------------------

func (h *UserAPIHandler) HandleGetMyList(w http.ResponseWriter, r *http.Request) {
	claims := h.getAuthenticatedClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	list, err := h.userRepo.GetMyList(claims.UID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"myList": list,
	})
}

func (h *UserAPIHandler) HandleAddToMyList(w http.ResponseWriter, r *http.Request) {
	claims := h.getAuthenticatedClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	movieID := r.PathValue("movieId")
	if movieID == "" {
		writeError(w, http.StatusBadRequest, "invalid_id", "Movie ID required")
		return
	}

	if err := h.userRepo.AddToMyList(claims.UID, movieID); err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"inList": true,
	})
}

func (h *UserAPIHandler) HandleRemoveFromMyList(w http.ResponseWriter, r *http.Request) {
	claims := h.getAuthenticatedClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	movieID := r.PathValue("movieId")
	if movieID == "" {
		writeError(w, http.StatusBadRequest, "invalid_id", "Movie ID required")
		return
	}

	if err := h.userRepo.RemoveFromMyList(claims.UID, movieID); err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"inList": false,
	})
}

// -----------------------------------------------------------------------------
// Watch Progress
// -----------------------------------------------------------------------------

func (h *UserAPIHandler) HandleGetProgress(w http.ResponseWriter, r *http.Request) {
	claims := h.getAuthenticatedClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	progressList, err := h.userRepo.GetProgress(claims.UID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	// Transform list to map by movie_id (matching frontend client expectation)
	progressMap := make(map[string]any)
	for _, p := range progressList {
		key := p.MovieID
		if p.EpisodeID != "" {
			key = p.MovieID + "_" + p.EpisodeID
		}
		progressMap[key] = map[string]any{
			"t":         p.T,
			"d":         p.D,
			"updatedAt": p.UpdatedAt,
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"progress": progressMap,
	})
}

func (h *UserAPIHandler) HandleUpdateProgress(w http.ResponseWriter, r *http.Request) {
	claims := h.getAuthenticatedClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	movieID := r.PathValue("movieId")
	if movieID == "" {
		writeError(w, http.StatusBadRequest, "invalid_id", "Movie ID required")
		return
	}

	var body struct {
		T         float64 `json:"t"`
		D         float64 `json:"d"`
		EpisodeID string  `json:"episodeId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON format")
		return
	}

	if body.T < 0 || body.D <= 0 {
		writeError(w, http.StatusBadRequest, "invalid_values", "t must be >= 0 and d must be > 0")
		return
	}

	wp := &repo.WatchProgress{
		UID:       claims.UID,
		MovieID:   movieID,
		EpisodeID: body.EpisodeID,
		T:         body.T,
		D:         body.D,
		UpdatedAt: time.Now().UnixMilli(),
	}

	if err := h.userRepo.SaveProgress(wp); err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
	})
}

// -----------------------------------------------------------------------------
// Live Online Presence (in-memory)
// -----------------------------------------------------------------------------

func (h *UserAPIHandler) HandlePresence(w http.ResponseWriter, r *http.Request) {
	claims := h.getAuthenticatedClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	// Update in-memory tracker (no disk write, preserves SSD and memory performance)
	liveCount := h.presence.Heartbeat(claims.UID)

	// Update user's last_seen timestamp throttled (not more than once every 5 minutes on disk)
	_ = h.userRepo.UpdateUserLastSeen(claims.UID, time.Now().UnixMilli())

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"online": liveCount,
	})
}

// -----------------------------------------------------------------------------
// Broken Link Reporter
// -----------------------------------------------------------------------------

func (h *UserAPIHandler) HandleBrokenLink(w http.ResponseWriter, r *http.Request) {
	claims := h.getAuthenticatedClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	var bl repo.BrokenLink
	if err := json.NewDecoder(r.Body).Decode(&bl); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid report body")
		return
	}

	if bl.MovieID == "" || bl.Title == "" {
		writeError(w, http.StatusBadRequest, "missing_fields", "Movie ID and Title are required")
		return
	}

	bl.ReporterUID = claims.UID
	if err := h.userRepo.ReportBrokenLink(&bl); err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"id": bl.ID,
	})
}

// -----------------------------------------------------------------------------
// Client Error Logger (Write-once, 4KB limit)
// -----------------------------------------------------------------------------

func (h *UserAPIHandler) HandleErrorLog(w http.ResponseWriter, r *http.Request) {
	claims := h.getAuthenticatedClaims(r)
	uid := "anonymous"
	if claims != nil {
		uid = claims.UID
	}

	// Rate limit per client
	rateKey := "err:" + uid + ":" + ClientIP(r)
	if !h.rateLimiter.Allow(rateKey) {
		writeError(w, http.StatusTooManyRequests, "rate_limited", "Error report rate limit exceeded")
		return
	}

	var el repo.ErrorLog
	if err := json.NewDecoder(r.Body).Decode(&el); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid error payload")
		return
	}

	if el.Message == "" {
		writeError(w, http.StatusBadRequest, "missing_message", "Error message is required")
		return
	}

	// Enforce 4000 byte limit as specified in old rules.js
	if len(el.Message) > 4000 {
		el.Message = el.Message[:4000]
	}

	el.UID = uid
	if err := h.userRepo.LogError(&el); err != nil {
		writeError(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
	})
}

// -----------------------------------------------------------------------------
// Password Reset (Public proxy to Firebase REST, rate limited)
// -----------------------------------------------------------------------------

func (h *UserAPIHandler) HandlePasswordReset(w http.ResponseWriter, r *http.Request) {
	ip := ClientIP(r)
	if !h.rateLimiter.Allow("pwd_reset:ip:" + ip) {
		writeError(w, http.StatusTooManyRequests, "rate_limited", "Too many password reset requests from this IP")
		return
	}

	var body struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	email := strings.TrimSpace(body.Email)
	if email == "" || !strings.Contains(email, "@") {
		writeError(w, http.StatusBadRequest, "invalid_email", "Valid email address required")
		return
	}

	// Rate limit per email
	if !h.rateLimiter.Allow("pwd_reset:email:" + email) {
		writeError(w, http.StatusTooManyRequests, "rate_limited", "Too many password reset attempts for this email")
		return
	}

	// Call Firebase Identity Toolkit sendOobCode if key is configured
	if h.cfg.FirebaseAPIKey != "" {
		fbPayload := map[string]any{
			"requestType": "PASSWORD_RESET",
			"email":       email,
		}
		fbBytes, _ := json.Marshal(fbPayload)
		fbURL := fmt.Sprintf("https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=%s", h.cfg.FirebaseAPIKey)
		resp, err := h.httpClient.Post(fbURL, "application/json", bytes.NewReader(fbBytes))
		if err == nil {
			_, _ = io.Copy(io.Discard, resp.Body)
			_ = resp.Body.Close()
		}
	}

	// Return generic success to prevent user enumeration
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": "If this email is registered in MoveX, a password reset link has been dispatched.",
	})
}
