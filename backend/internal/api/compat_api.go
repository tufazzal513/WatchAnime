package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"movex/internal/config"
	"movex/internal/presence"
	"movex/internal/repo"
)

// CompatAPIHandler handles legacy Firebase Realtime DB compatible requests (/api/db/*).
type CompatAPIHandler struct {
	cfg         *config.Config
	movieRepo   *repo.MovieRepo
	catalogRepo *repo.CatalogRepo
	userRepo    *repo.UserRepo
	presence    *presence.Tracker
}

func NewCompatAPIHandler(
	cfg *config.Config,
	mRepo *repo.MovieRepo,
	cRepo *repo.CatalogRepo,
	uRepo *repo.UserRepo,
	pTracker *presence.Tracker,
) *CompatAPIHandler {
	return &CompatAPIHandler{
		cfg:         cfg,
		movieRepo:   mRepo,
		catalogRepo: cRepo,
		userRepo:    uRepo,
		presence:    pTracker,
	}
}

// HandleDB routes /api/db/{path...} requests to appropriate repo operations.
func (h *CompatAPIHandler) HandleDB(w http.ResponseWriter, r *http.Request) {
	subPath := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/db"), "/")
	parts := strings.Split(subPath, "/")
	if len(parts) == 0 || parts[0] == "" {
		http.Error(w, `{"error":"invalid path"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	rootEntity := parts[0]
	switch rootEntity {
	case "movies":
		h.handleMovies(w, r, parts[1:])
	case "banners":
		h.handleBanners(w, r)
	case "categories":
		h.handleCategories(w, r)
	case "socialLinks":
		h.handleSocialLinks(w, r)
	case "notifications":
		h.handleNotifications(w, r)
	case "settings":
		h.handleSettings(w, r, parts[1:])
	case "users":
		h.handleUsers(w, r, parts[1:])
	case "online_users":
		h.handleOnlineUsers(w, r, parts[1:])
	case "broken_links":
		h.handleBrokenLinks(w, r, parts[1:])
	case "analytics":
		if len(parts) > 1 && parts[1] == "errors" {
			h.handleErrors(w, r)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
	case "searchStats":
		h.handleSearchStats(w, r, parts[1:])
	case "stats":
		h.handleStats(w, r, parts[1:])
	default:
		_ = json.NewEncoder(w).Encode(nil)
	}
}

func (h *CompatAPIHandler) handleMovies(w http.ResponseWriter, r *http.Request, parts []string) {
	if len(parts) == 0 || parts[0] == "" {
		// List all movies as a map keyed by ID
		movies, _, err := h.movieRepo.ListMovies(repo.MovieFilter{Limit: 2000})
		if err != nil {
			http.Error(w, `{"error":"failed to load movies"}`, http.StatusInternalServerError)
			return
		}
		result := make(map[string]any, len(movies))
		for _, m := range movies {
			firstGenre := ""
			if m.Genres != "" {
				firstGenre = strings.TrimSpace(strings.Split(m.Genres, ",")[0])
			}
			result[m.ID] = map[string]any{
				"id":          m.ID,
				"title":       m.Title,
				"contentType": m.ContentType,
				"posterUrl":   m.PosterURL,
				"backdropUrl": m.BackdropURL,
				"coverUrl":    m.BackdropURL,
				"year":        m.Year,
				"rating":      m.Rating,
				"overview":    m.Overview,
				"description": m.Overview,
				"genres":      m.Genres,
				"category":    firstGenre,
				"language":    m.Language,
				"country":     m.Country,
				"industry":    m.Industry,
				"views":       m.Views,
				"isFeatured":  m.IsFeatured,
				"isPrivate":   m.IsPrivate,
				"isUpcoming":  m.IsUpcoming,
				"releaseDate": m.ReleaseDate,
				"updatedAt":   m.UpdatedAt,
			}
		}
		_ = json.NewEncoder(w).Encode(result)
		return
	}

	// Single movie by ID
	movieID := parts[0]
	full, err := h.movieRepo.GetMovieFull(movieID)
	if err != nil {
		_ = json.NewEncoder(w).Encode(nil)
		return
	}
	_ = json.NewEncoder(w).Encode(full)
}

func (h *CompatAPIHandler) handleBanners(w http.ResponseWriter, r *http.Request) {
	banners, err := h.catalogRepo.ListBanners(true)
	if err != nil {
		_ = json.NewEncoder(w).Encode(map[string]any{})
		return
	}
	res := make(map[string]any, len(banners))
	for _, b := range banners {
		res[b.ID] = map[string]any{
			"id":        b.ID,
			"title":     b.Title,
			"imageUrl":  b.ImageURL,
			"linkUrl":   b.LinkURL,
			"movieId":   b.MovieID,
			"sortOrder": b.SortOrder,
			"active":    b.Active,
		}
	}
	_ = json.NewEncoder(w).Encode(res)
}

func (h *CompatAPIHandler) handleCategories(w http.ResponseWriter, r *http.Request) {
	cats, err := h.catalogRepo.ListCategories()
	if err != nil {
		_ = json.NewEncoder(w).Encode(map[string]any{})
		return
	}
	res := make(map[string]any, len(cats))
	for _, c := range cats {
		res[c.ID] = map[string]any{
			"id":        c.ID,
			"name":      c.Name,
			"sortOrder": c.SortOrder,
		}
	}
	_ = json.NewEncoder(w).Encode(res)
}

func (h *CompatAPIHandler) handleSocialLinks(w http.ResponseWriter, r *http.Request) {
	socials, err := h.catalogRepo.ListSocialLinks()
	if err != nil {
		_ = json.NewEncoder(w).Encode(map[string]any{})
		return
	}
	res := make(map[string]any, len(socials))
	for _, s := range socials {
		res[s.ID] = map[string]any{
			"id":        s.ID,
			"name":      s.Name,
			"url":       s.URL,
			"icon":      s.Icon,
			"sortOrder": s.SortOrder,
		}
	}
	_ = json.NewEncoder(w).Encode(res)
}

func (h *CompatAPIHandler) handleNotifications(w http.ResponseWriter, r *http.Request) {
	notes, err := h.catalogRepo.ListNotifications(25)
	if err != nil {
		_ = json.NewEncoder(w).Encode(map[string]any{})
		return
	}
	res := make(map[string]any, len(notes))
	for _, n := range notes {
		res[n.ID] = map[string]any{
			"id":        n.ID,
			"title":     n.Title,
			"message":   n.Message,
			"link":      n.Link,
			"createdAt": n.CreatedAt,
		}
	}
	_ = json.NewEncoder(w).Encode(res)
}

func (h *CompatAPIHandler) handleSettings(w http.ResponseWriter, r *http.Request, parts []string) {
	settings, _ := h.catalogRepo.GetAllPublicSettings()
	if settings == nil {
		settings = make(map[string]string)
	}
	// Defaults
	if settings["site_name"] == "" {
		settings["site_name"] = "MoveX"
	}
	settings["appName"] = settings["site_name"]
	settings["appLogo"] = settings["logo_url"]

	if len(parts) > 0 && parts[0] != "" {
		key := parts[0]
		_ = json.NewEncoder(w).Encode(settings[key])
		return
	}

	_ = json.NewEncoder(w).Encode(settings)
}

func (h *CompatAPIHandler) handleUsers(w http.ResponseWriter, r *http.Request, parts []string) {
	if len(parts) == 0 || parts[0] == "" {
		http.Error(w, `{"error":"missing uid"}`, http.StatusBadRequest)
		return
	}
	uid := parts[0]

	// users/{uid}/myList...
	if len(parts) > 1 && parts[1] == "myList" {
		if len(parts) > 2 && parts[2] != "" {
			movieID := parts[2]
			if r.Method == http.MethodDelete {
				_ = h.userRepo.RemoveFromMyList(uid, movieID)
				_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
				return
			}
			// PUT
			_ = h.userRepo.AddToMyList(uid, movieID)
			_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
			return
		}
		// GET myList
		list, _ := h.userRepo.GetMyList(uid)
		res := make(map[string]any, len(list))
		for _, m := range list {
			res[m.ID] = m.UpdatedAt
		}
		_ = json.NewEncoder(w).Encode(res)
		return
	}

	// users/{uid}/progress...
	if len(parts) > 1 && parts[1] == "progress" {
		if len(parts) > 2 && parts[2] != "" {
			movieID := parts[2]
			if r.Method == http.MethodPut || r.Method == http.MethodPatch {
				var p repo.WatchProgress
				_ = json.NewDecoder(r.Body).Decode(&p)
				p.UID = uid
				p.MovieID = movieID
				_ = h.userRepo.SaveProgress(&p)
				_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
				return
			}
		}
		// GET progress list
		progs, _ := h.userRepo.GetProgress(uid)
		res := make(map[string]any, len(progs))
		for _, p := range progs {
			res[p.MovieID] = map[string]any{
				"t":         p.T,
				"d":         p.D,
				"updatedAt": p.UpdatedAt,
			}
		}
		_ = json.NewEncoder(w).Encode(res)
		return
	}

	// users/{uid}/status
	if len(parts) > 1 && parts[1] == "status" {
		u, _ := h.userRepo.GetUser(uid)
		if u == nil {
			_ = json.NewEncoder(w).Encode("active")
			return
		}
		_ = json.NewEncoder(w).Encode(u.Status)
		return
	}

	// Single user record
	if r.Method == http.MethodDelete {
		_ = h.userRepo.DeleteUserData(uid)
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
		return
	}

	if r.Method == http.MethodPut || r.Method == http.MethodPatch {
		var u repo.User
		_ = json.NewDecoder(r.Body).Decode(&u)
		u.UID = uid
		if u.Status == "" {
			u.Status = "active"
		}
		_ = h.userRepo.UpsertUser(&u)
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
		return
	}

	// GET user
	u, _ := h.userRepo.GetUser(uid)
	if u == nil {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"uid":    uid,
			"status": "active",
		})
		return
	}
	_ = json.NewEncoder(w).Encode(u)
}

func (h *CompatAPIHandler) handleOnlineUsers(w http.ResponseWriter, r *http.Request, parts []string) {
	if len(parts) > 0 && parts[0] != "" {
		h.presence.Heartbeat(parts[0])
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
}

func (h *CompatAPIHandler) handleBrokenLinks(w http.ResponseWriter, r *http.Request, parts []string) {
	var bl repo.BrokenLink
	_ = json.NewDecoder(r.Body).Decode(&bl)
	if len(parts) > 0 && parts[0] != "" && bl.MovieID == "" {
		bl.MovieID = parts[0]
	}
	_ = h.userRepo.ReportBrokenLink(&bl)
	_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
}

func (h *CompatAPIHandler) handleErrors(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	_ = json.NewDecoder(r.Body).Decode(&body)
	msg, _ := body["message"].(string)
	if msg == "" {
		msg, _ = body["err"].(string)
	}
	if msg == "" {
		msg = "client report"
	}
	_ = h.userRepo.LogError(&repo.ErrorLog{
		Message:    msg,
		CreatedAt:  time.Now().UnixMilli(),
		ClientInfo: "user-frontend",
	})
	_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
}

func (h *CompatAPIHandler) handleSearchStats(w http.ResponseWriter, r *http.Request, parts []string) {
	if (r.Method == http.MethodPut || r.Method == http.MethodPatch || r.Method == http.MethodPost) && len(parts) > 0 && parts[0] != "" {
		_ = h.userRepo.RecordSearchHit(parts[0])
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
		return
	}

	// GET search stats
	stats, _ := h.userRepo.GetSearchSuggestions("", 12)
	res := make(map[string]any, len(stats))
	for _, s := range stats {
		res[s.Term] = map[string]any{
			"t":  s.Term,
			"c":  s.Count,
			"at": s.LastSearchedAt,
		}
	}
	_ = json.NewEncoder(w).Encode(res)
}

func (h *CompatAPIHandler) handleStats(w http.ResponseWriter, r *http.Request, parts []string) {
	if len(parts) > 1 && parts[1] == "plays" {
		movieID := parts[0]
		_ = h.movieRepo.IncrementViews(movieID)
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
}
