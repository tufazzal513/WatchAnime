package admin

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"embed"
	"encoding/hex"
	"fmt"
	"html/template"
	"io/fs"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"movex/internal/auth"
	"movex/internal/backup"
	"movex/internal/config"
	"movex/internal/presence"
	"movex/internal/repo"
)

//go:embed templates/*.html static/*
var contentFS embed.FS

type AdminHandler struct {
	cfg         *config.Config
	adminMgr    *auth.AdminManager
	movieRepo   *repo.MovieRepo
	catalogRepo *repo.CatalogRepo
	userRepo    *repo.UserRepo
	presence    *presence.Tracker
	tmplMap     map[string]*template.Template
	db          *sql.DB
	backupFn    func() error
}

func (h *AdminHandler) SetDB(database *sql.DB) {
	h.db = database
}

func (h *AdminHandler) SetBackupFn(fn func() error) {
	h.backupFn = fn
}

func NewAdminHandler(
	cfg *config.Config,
	adminMgr *auth.AdminManager,
	mRepo *repo.MovieRepo,
	cRepo *repo.CatalogRepo,
	uRepo *repo.UserRepo,
	pTracker *presence.Tracker,
) (*AdminHandler, error) {
	h := &AdminHandler{
		cfg:         cfg,
		adminMgr:    adminMgr,
		movieRepo:   mRepo,
		catalogRepo: cRepo,
		userRepo:    uRepo,
		presence:    pTracker,
		tmplMap:     make(map[string]*template.Template),
	}

	funcMap := template.FuncMap{
		"add": func(a, b int) int { return a + b },
		"sub": func(a, b int) int { return a - b },
		"min": func(a, b int) int {
			if a < b {
				return a
			}
			return b
		},
	}

	pages := []string{
		"dashboard.html",
		"movies_list.html",
		"movie_form.html",
		"categories.html",
		"banners.html",
		"users.html",
		"broken_links.html",
		"settings.html",
		"server.html",
	}
	for _, page := range pages {
		t, err := template.New("layout").Funcs(funcMap).ParseFS(contentFS, "templates/layout.html", "templates/"+page)
		if err != nil {
			return nil, fmt.Errorf("failed to parse template %s: %w", page, err)
		}
		h.tmplMap[page] = t
	}

	// Login page has standalone layout
	loginTmpl, err := template.ParseFS(contentFS, "templates/login.html")
	if err != nil {
		return nil, fmt.Errorf("failed to parse login template: %w", err)
	}
	h.tmplMap["login.html"] = loginTmpl

	return h, nil
}

func (h *AdminHandler) StaticFS() http.Handler {
	sub, err := fs.Sub(contentFS, "static")
	if err != nil {
		return http.NotFoundHandler()
	}
	return http.StripPrefix("/admin/static/", http.FileServer(http.FS(sub)))
}

// -----------------------------------------------------------------------------
// Authentication: Login & Logout
// -----------------------------------------------------------------------------

func (h *AdminHandler) HandleLoginView(w http.ResponseWriter, r *http.Request) {
	// If already authenticated, redirect to dashboard
	if _, err := h.adminMgr.GetAdminSession(r); err == nil {
		http.Redirect(w, r, "/admin/", http.StatusSeeOther)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = h.tmplMap["login.html"].ExecuteTemplate(w, "login.html", map[string]any{
		"Email": r.URL.Query().Get("email"),
		"Error": r.URL.Query().Get("error"),
	})
}

func (h *AdminHandler) HandleLoginPost(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/admin/login?error=Invalid+form+submission", http.StatusSeeOther)
		return
	}

	email := strings.TrimSpace(r.FormValue("email"))
	password := r.FormValue("password")

	uid, err := h.adminMgr.AuthenticateAdmin(email, password)
	if err != nil {
		errMsg := "Authentication failed: " + err.Error()
		http.Redirect(w, r, "/admin/login?email="+email+"&error="+errMsg, http.StatusSeeOther)
		return
	}

	h.adminMgr.SetAdminSession(w, uid)
	http.Redirect(w, r, "/admin/", http.StatusSeeOther)
}

func (h *AdminHandler) HandleLogout(w http.ResponseWriter, r *http.Request) {
	h.adminMgr.ClearAdminSession(w)
	http.Redirect(w, r, "/admin/login", http.StatusSeeOther)
}

// -----------------------------------------------------------------------------
// Dashboard Handler
// -----------------------------------------------------------------------------

func (h *AdminHandler) HandleDashboard(w http.ResponseWriter, r *http.Request) {
	adminUID, _ := r.Context().Value(auth.AdminUIDKey).(string)
	csrfToken := h.adminMgr.GenerateCSRFToken(adminUID)

	// Fetch Stats
	allMovies, totalMovies, _ := h.movieRepo.ListMovies(repo.MovieFilter{Limit: 1000})
	totalSeries := 0
	totalSingleMovies := 0
	for _, m := range allMovies {
		if m.ContentType == "series" {
			totalSeries++
		} else {
			totalSingleMovies++
		}
	}

	users, totalUsers, _ := h.userRepo.ListUsers("", "all", 0, 10000)
	now := time.Now().UnixMilli()
	active24h := 0
	dayMs := int64(24 * 60 * 60 * 1000)
	for _, u := range users {
		if u.Status != "deleted" && (now-u.LastSeen <= dayMs || now-u.LastLoginAt <= dayMs) {
			active24h++
		}
	}

	brokenLinks, _ := h.userRepo.ListBrokenLinks("open", "all", "")
	recentBroken := brokenLinks
	if len(recentBroken) > 5 {
		recentBroken = recentBroken[:5]
	}

	searchStats, _ := h.userRepo.GetSearchSuggestions("", 5)

	// Chart filter
	chartDays, _ := strconv.Atoi(r.URL.Query().Get("days"))
	if chartDays != 7 && chartDays != 30 && chartDays != 90 {
		chartDays = 30
	}
	chartSVG := GenerateUserGrowthChartSVG(users, chartDays)

	data := map[string]any{
		"Title":             "Dashboard Overview",
		"ActiveNav":         "dashboard",
		"Role":              h.cfg.Role,
		"AdminUID":          adminUID,
		"CSRFToken":         csrfToken,
		"LiveOnline":        h.presence.LiveCount(),
		"TotalMovies":       totalMovies,
		"TotalSeries":       totalSeries,
		"TotalSingleMovies": totalSingleMovies,
		"TotalUsers":        totalUsers,
		"Active24h":         active24h,
		"BrokenLinksCount":  len(brokenLinks),
		"RecentBrokenLinks": recentBroken,
		"SearchStats":       searchStats,
		"ChartDays":         chartDays,
		"ChartSVG":          chartSVG,
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = h.tmplMap["dashboard.html"].ExecuteTemplate(w, "layout", data)
}

// -----------------------------------------------------------------------------
// Movies Management Handlers
// -----------------------------------------------------------------------------

func (h *AdminHandler) HandleListMovies(w http.ResponseWriter, r *http.Request) {
	adminUID, _ := r.Context().Value(auth.AdminUIDKey).(string)
	csrfToken := h.adminMgr.GenerateCSRFToken(adminUID)

	q := r.URL.Query()
	offset, _ := strconv.Atoi(q.Get("offset"))
	if offset < 0 {
		offset = 0
	}
	limit := 25

	filter := repo.MovieFilter{
		Query:       q.Get("q"),
		ContentType: q.Get("type"),
		Offset:      offset,
		Limit:       limit,
	}

	statusFilter := q.Get("status")
	if statusFilter == "featured" {
		f := true
		filter.IsFeatured = &f
	} else if statusFilter == "private" {
		p := true
		filter.IsPrivate = &p
	} else if statusFilter == "upcoming" {
		u := true
		filter.IsUpcoming = &u
	}

	movies, total, err := h.movieRepo.ListMovies(filter)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	brokenLinks, _ := h.userRepo.ListBrokenLinks("open", "all", "")

	data := map[string]any{
		"Title":            "Content Catalog",
		"ActiveNav":        "movies",
		"Role":             h.cfg.Role,
		"AdminUID":         adminUID,
		"CSRFToken":        csrfToken,
		"LiveOnline":       h.presence.LiveCount(),
		"BrokenLinksCount": len(brokenLinks),
		"Movies":           movies,
		"TotalCount":       total,
		"Offset":           offset,
		"Limit":            limit,
		"FilterType":       q.Get("type"),
		"FilterStatus":     statusFilter,
		"SearchQuery":      q.Get("q"),
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = h.tmplMap["movies_list.html"].ExecuteTemplate(w, "layout", data)
}

func (h *AdminHandler) HandleNewMovie(w http.ResponseWriter, r *http.Request) {
	adminUID, _ := r.Context().Value(auth.AdminUIDKey).(string)
	csrfToken := h.adminMgr.GenerateCSRFToken(adminUID)
	brokenLinks, _ := h.userRepo.ListBrokenLinks("open", "all", "")

	data := map[string]any{
		"Title":            "Add New Content",
		"ActiveNav":        "movie_new",
		"Role":             h.cfg.Role,
		"AdminUID":         adminUID,
		"CSRFToken":        csrfToken,
		"LiveOnline":       h.presence.LiveCount(),
		"BrokenLinksCount": len(brokenLinks),
		"Movie": repo.Movie{
			ContentType: "movie",
			Year:        time.Now().Year(),
		},
		"StreamLinks":   []repo.StreamLink{},
		"DownloadLinks": []repo.DownloadLink{},
		"Seasons":       []repo.SeasonWithEpisodes{},
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = h.tmplMap["movie_form.html"].ExecuteTemplate(w, "layout", data)
}

func (h *AdminHandler) HandleEditMovie(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Redirect(w, r, "/admin/movies", http.StatusSeeOther)
		return
	}

	movieFull, err := h.movieRepo.GetMovieFull(id)
	if err != nil {
		http.Redirect(w, r, "/admin/movies?error=Movie+not+found", http.StatusSeeOther)
		return
	}

	adminUID, _ := r.Context().Value(auth.AdminUIDKey).(string)
	csrfToken := h.adminMgr.GenerateCSRFToken(adminUID)
	brokenLinks, _ := h.userRepo.ListBrokenLinks("open", "all", "")

	data := map[string]any{
		"Title":            "Edit: " + movieFull.Title,
		"ActiveNav":        "movies",
		"Role":             h.cfg.Role,
		"AdminUID":         adminUID,
		"CSRFToken":        csrfToken,
		"LiveOnline":       h.presence.LiveCount(),
		"BrokenLinksCount": len(brokenLinks),
		"Movie":            movieFull.Movie,
		"StreamLinks":      movieFull.StreamLinks,
		"DownloadLinks":    movieFull.DownloadLinks,
		"Seasons":          movieFull.Seasons,
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = h.tmplMap["movie_form.html"].ExecuteTemplate(w, "layout", data)
}

func (h *AdminHandler) HandleSaveMovie(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	id := r.FormValue("id")
	title := strings.TrimSpace(r.FormValue("title"))
	if title == "" {
		http.Error(w, "Title is required", http.StatusBadRequest)
		return
	}

	contentType := r.FormValue("content_type")
	if contentType != "series" {
		contentType = "movie"
	}

	year, _ := strconv.Atoi(r.FormValue("year"))
	rating, _ := strconv.ParseFloat(r.FormValue("rating"), 64)

	movie := &repo.Movie{
		ID:          id,
		Title:       title,
		ContentType: contentType,
		PosterURL:   r.FormValue("poster_url"),
		BackdropURL: r.FormValue("backdrop_url"),
		Year:        year,
		Rating:      rating,
		Overview:    r.FormValue("overview"),
		Language:    r.FormValue("language"),
		Country:     r.FormValue("country"),
		Industry:    r.FormValue("industry"),
		Genres:      r.FormValue("genres"),
		IsFeatured:  r.FormValue("is_featured") == "1",
		IsPrivate:   r.FormValue("is_private") == "1",
		IsUpcoming:  r.FormValue("is_upcoming") == "1",
	}

	// Categories list parsed from genres
	var catNames []string
	if movie.Genres != "" {
		for _, g := range strings.Split(movie.Genres, ",") {
			trimmed := strings.TrimSpace(g)
			if trimmed != "" {
				catNames = append(catNames, trimmed)
			}
		}
	}

	var streamLinks []repo.StreamLink
	var downloadLinks []repo.DownloadLink
	var seasons []repo.SeasonWithEpisodes

	if contentType == "movie" {
		// Movie Streams
		serverTypes := r.Form["stream_server_type[]"]
		urls := r.Form["stream_url[]"]
		labels := r.Form["stream_label[]"]
		for i, u := range urls {
			u = strings.TrimSpace(u)
			if u == "" {
				continue
			}
			st := "EMBED"
			if i < len(serverTypes) && serverTypes[i] != "" {
				st = serverTypes[i]
			} else {
				st = AutoDetectServerType(u)
			}
			lbl := "Server"
			if i < len(labels) && labels[i] != "" {
				lbl = labels[i]
			}
			streamLinks = append(streamLinks, repo.StreamLink{
				ServerType: st,
				URL:        u,
				Label:      lbl,
				SortOrder:  i,
			})
		}

		// Movie Downloads
		qualities := r.Form["download_quality[]"]
		sizes := r.Form["download_size[]"]
		dlURLs := r.Form["download_url[]"]
		dlLabels := r.Form["download_label[]"]
		for i, u := range dlURLs {
			u = strings.TrimSpace(u)
			if u == "" {
				continue
			}
			q := "1080p"
			if i < len(qualities) && qualities[i] != "" {
				q = qualities[i]
			}
			sz := ""
			if i < len(sizes) {
				sz = sizes[i]
			}
			lbl := "Direct"
			if i < len(dlLabels) && dlLabels[i] != "" {
				lbl = dlLabels[i]
			}
			downloadLinks = append(downloadLinks, repo.DownloadLink{
				Quality:   q,
				Size:      sz,
				URL:       u,
				Label:     lbl,
				SortOrder: i,
			})
		}
	} else {
		// Series Dual-Wheel seasons & episodes
		for k := range r.Form {
			if strings.HasPrefix(k, "season_number_") {
				sIdx := strings.TrimPrefix(k, "season_number_")
				sNum, _ := strconv.Atoi(r.FormValue(k))
				sTitle := r.FormValue("season_title_" + sIdx)

				s := repo.SeasonWithEpisodes{
					Season: repo.Season{
						SeasonNumber: sNum,
						Title:        sTitle,
					},
					Episodes: []repo.EpisodeWithLinks{},
				}

				epNums := r.Form["ep_num_"+sIdx+"[]"]
				epTitles := r.Form["ep_title_"+sIdx+"[]"]
				epStreams := r.Form["ep_stream_"+sIdx+"[]"]
				epServers := r.Form["ep_server_"+sIdx+"[]"]

				for e := range epStreams {
					streamURL := strings.TrimSpace(epStreams[e])
					epN, _ := strconv.Atoi(epNums[e])
					if epN == 0 {
						epN = e + 1
					}
					epT := "Episode " + strconv.Itoa(epN)
					if e < len(epTitles) && epTitles[e] != "" {
						epT = epTitles[e]
					}

					st := "VIDEASY"
					if e < len(epServers) && epServers[e] != "" {
						st = epServers[e]
					} else if streamURL != "" {
						st = AutoDetectServerType(streamURL)
					}

					var epStreamsList []repo.StreamLink
					if streamURL != "" {
						epStreamsList = append(epStreamsList, repo.StreamLink{
							ServerType: st,
							URL:        streamURL,
							Label:      st,
						})
					}

					s.Episodes = append(s.Episodes, repo.EpisodeWithLinks{
						Episode: repo.Episode{
							EpisodeNumber: epN,
							Title:         epT,
						},
						StreamLinks: epStreamsList,
					})
				}
				seasons = append(seasons, s)
			}
		}
	}

	if err := h.movieRepo.SaveMovie(movie, catNames, streamLinks, downloadLinks, seasons); err != nil {
		http.Error(w, "Failed to save content: "+err.Error(), http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin/movies", http.StatusSeeOther)
}

func (h *AdminHandler) HandleDeleteMovie(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id != "" {
		_ = h.movieRepo.DeleteMovie(id)
	}
	http.Redirect(w, r, "/admin/movies", http.StatusSeeOther)
}

// -----------------------------------------------------------------------------
// Categories Management
// -----------------------------------------------------------------------------

func (h *AdminHandler) HandleListCategories(w http.ResponseWriter, r *http.Request) {
	adminUID, _ := r.Context().Value(auth.AdminUIDKey).(string)
	csrfToken := h.adminMgr.GenerateCSRFToken(adminUID)
	brokenLinks, _ := h.userRepo.ListBrokenLinks("open", "all", "")

	categories, err := h.catalogRepo.ListCategories()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	data := map[string]any{
		"Title":            "Categories & Taxonomy",
		"ActiveNav":        "categories",
		"Role":             h.cfg.Role,
		"AdminUID":         adminUID,
		"CSRFToken":        csrfToken,
		"LiveOnline":       h.presence.LiveCount(),
		"BrokenLinksCount": len(brokenLinks),
		"Categories":       categories,
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = h.tmplMap["categories.html"].ExecuteTemplate(w, "layout", data)
}

func (h *AdminHandler) HandleSaveCategory(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	id := strings.TrimSpace(r.FormValue("id"))
	name := strings.TrimSpace(r.FormValue("name"))
	sortOrder, _ := strconv.Atoi(r.FormValue("sort_order"))

	if name == "" {
		http.Redirect(w, r, "/admin/categories?error=Category+name+is+required", http.StatusSeeOther)
		return
	}

	cat := &repo.Category{
		ID:        id,
		Name:      name,
		SortOrder: sortOrder,
	}
	if err := h.catalogRepo.SaveCategory(cat); err != nil {
		http.Error(w, "Failed to save category: "+err.Error(), http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin/categories", http.StatusSeeOther)
}

func (h *AdminHandler) HandleDeleteCategory(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id != "" {
		_ = h.catalogRepo.DeleteCategory(id)
	}
	http.Redirect(w, r, "/admin/categories", http.StatusSeeOther)
}

// -----------------------------------------------------------------------------
// Banners Management
// -----------------------------------------------------------------------------

func (h *AdminHandler) HandleListBanners(w http.ResponseWriter, r *http.Request) {
	adminUID, _ := r.Context().Value(auth.AdminUIDKey).(string)
	csrfToken := h.adminMgr.GenerateCSRFToken(adminUID)
	brokenLinks, _ := h.userRepo.ListBrokenLinks("open", "all", "")

	banners, err := h.catalogRepo.ListBanners(false) // all banners
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	data := map[string]any{
		"Title":            "Hero & Carousel Banners",
		"ActiveNav":        "banners",
		"Role":             h.cfg.Role,
		"AdminUID":         adminUID,
		"CSRFToken":        csrfToken,
		"LiveOnline":       h.presence.LiveCount(),
		"BrokenLinksCount": len(brokenLinks),
		"Banners":          banners,
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = h.tmplMap["banners.html"].ExecuteTemplate(w, "layout", data)
}

func (h *AdminHandler) HandleSaveBanner(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	id := strings.TrimSpace(r.FormValue("id"))
	title := strings.TrimSpace(r.FormValue("title"))
	imageURL := strings.TrimSpace(r.FormValue("image_url"))
	linkURL := strings.TrimSpace(r.FormValue("link_url"))
	sortOrder, _ := strconv.Atoi(r.FormValue("sort_order"))
	active := r.FormValue("active") == "1"

	if imageURL == "" {
		http.Redirect(w, r, "/admin/banners?error=Image+URL+is+required", http.StatusSeeOther)
		return
	}

	b := &repo.Banner{
		ID:        id,
		Title:     title,
		ImageURL:  imageURL,
		LinkURL:   linkURL,
		SortOrder: sortOrder,
		Active:    active,
	}
	if err := h.catalogRepo.SaveBanner(b); err != nil {
		http.Error(w, "Failed to save banner: "+err.Error(), http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin/banners", http.StatusSeeOther)
}

func (h *AdminHandler) HandleDeleteBanner(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id != "" {
		_ = h.catalogRepo.DeleteBanner(id)
	}
	http.Redirect(w, r, "/admin/banners", http.StatusSeeOther)
}

// -----------------------------------------------------------------------------
// Users Management
// -----------------------------------------------------------------------------

type UserViewModel struct {
	repo.User
	IsLiveOnline      bool
	LastSeenFormatted string
	CreatedFormatted  string
}

func (h *AdminHandler) HandleListUsers(w http.ResponseWriter, r *http.Request) {
	adminUID, _ := r.Context().Value(auth.AdminUIDKey).(string)
	csrfToken := h.adminMgr.GenerateCSRFToken(adminUID)
	brokenLinks, _ := h.userRepo.ListBrokenLinks("open", "all", "")

	q := r.URL.Query()
	offset, _ := strconv.Atoi(q.Get("offset"))
	if offset < 0 {
		offset = 0
	}
	limit := 25
	statusFilter := q.Get("status")
	searchQuery := q.Get("q")

	rawUsers, total, err := h.userRepo.ListUsers(searchQuery, statusFilter, offset, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var users []UserViewModel
	for _, u := range rawUsers {
		uvm := UserViewModel{
			User:         u,
			IsLiveOnline: h.presence.IsOnline(u.UID),
		}
		if u.LastSeen > 0 {
			uvm.LastSeenFormatted = time.UnixMilli(u.LastSeen).Format("2006-01-02 15:04")
		}
		if u.CreatedAt > 0 {
			uvm.CreatedFormatted = time.UnixMilli(u.CreatedAt).Format("2006-01-02")
		}
		users = append(users, uvm)
	}

	data := map[string]any{
		"Title":            "User Accounts",
		"ActiveNav":        "users",
		"Role":             h.cfg.Role,
		"AdminUID":         adminUID,
		"CSRFToken":        csrfToken,
		"LiveOnline":       h.presence.LiveCount(),
		"BrokenLinksCount": len(brokenLinks),
		"Users":            users,
		"TotalCount":       total,
		"Offset":           offset,
		"Limit":            limit,
		"FilterStatus":     statusFilter,
		"SearchQuery":      searchQuery,
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = h.tmplMap["users.html"].ExecuteTemplate(w, "layout", data)
}

func (h *AdminHandler) HandleUpdateUserStatus(w http.ResponseWriter, r *http.Request) {
	uid := r.PathValue("uid")
	status := r.FormValue("status")
	if uid != "" && (status == "active" || status == "frozen" || status == "deleted") {
		_ = h.userRepo.UpdateUserStatus(uid, status)
	}
	http.Redirect(w, r, "/admin/users", http.StatusSeeOther)
}

func (h *AdminHandler) HandleDeleteUserData(w http.ResponseWriter, r *http.Request) {
	uid := r.PathValue("uid")
	if uid != "" {
		_ = h.userRepo.DeleteUserData(uid)
	}
	http.Redirect(w, r, "/admin/users", http.StatusSeeOther)
}

// -----------------------------------------------------------------------------
// Broken Links Management
// -----------------------------------------------------------------------------

type BrokenLinkViewModel struct {
	repo.BrokenLink
	ReportedFormatted string
}

func (h *AdminHandler) HandleListBrokenLinks(w http.ResponseWriter, r *http.Request) {
	adminUID, _ := r.Context().Value(auth.AdminUIDKey).(string)
	csrfToken := h.adminMgr.GenerateCSRFToken(adminUID)

	statusFilter := r.URL.Query().Get("status")
	if statusFilter == "" {
		statusFilter = "open"
	}
	searchQuery := r.URL.Query().Get("q")

	rawLinks, err := h.userRepo.ListBrokenLinks(statusFilter, "all", searchQuery)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	openCount := 0
	var links []BrokenLinkViewModel
	for _, l := range rawLinks {
		if l.Status == "open" {
			openCount++
		}
		blvm := BrokenLinkViewModel{
			BrokenLink: l,
		}
		if l.ReportedAt > 0 {
			blvm.ReportedFormatted = time.UnixMilli(l.ReportedAt).Format("2006-01-02 15:04")
		}
		links = append(links, blvm)
	}

	data := map[string]any{
		"Title":            "Broken Link Reports",
		"ActiveNav":        "broken",
		"Role":             h.cfg.Role,
		"AdminUID":         adminUID,
		"CSRFToken":        csrfToken,
		"LiveOnline":       h.presence.LiveCount(),
		"BrokenLinksCount": openCount,
		"BrokenLinks":      links,
		"FilterStatus":     statusFilter,
		"SearchQuery":      searchQuery,
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = h.tmplMap["broken_links.html"].ExecuteTemplate(w, "layout", data)
}

func (h *AdminHandler) HandleUpdateBrokenLinkStatus(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	status := r.FormValue("status")
	if id != "" && (status == "fixed" || status == "ignored" || status == "open") {
		_ = h.userRepo.UpdateBrokenLinkStatus(id, status)
	}
	http.Redirect(w, r, "/admin/broken-links", http.StatusSeeOther)
}

func (h *AdminHandler) HandleDeleteBrokenLink(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id != "" {
		_ = h.userRepo.DeleteBrokenLink(id)
	}
	http.Redirect(w, r, "/admin/broken-links", http.StatusSeeOther)
}

// -----------------------------------------------------------------------------
// Settings & Socials & Notifications
// -----------------------------------------------------------------------------

func (h *AdminHandler) HandleSettingsView(w http.ResponseWriter, r *http.Request) {
	adminUID, _ := r.Context().Value(auth.AdminUIDKey).(string)
	csrfToken := h.adminMgr.GenerateCSRFToken(adminUID)
	brokenLinks, _ := h.userRepo.ListBrokenLinks("open", "all", "")

	settings, _ := h.catalogRepo.GetAllPublicSettings()
	socials, _ := h.catalogRepo.ListSocialLinks()
	notes, _ := h.catalogRepo.ListNotifications(20)

	data := map[string]any{
		"Title":            "App Settings & Announcements",
		"ActiveNav":        "settings",
		"Role":             h.cfg.Role,
		"AdminUID":         adminUID,
		"CSRFToken":        csrfToken,
		"LiveOnline":       h.presence.LiveCount(),
		"BrokenLinksCount": len(brokenLinks),
		"Settings":         settings,
		"SocialLinks":      socials,
		"Notifications":    notes,
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = h.tmplMap["settings.html"].ExecuteTemplate(w, "layout", data)
}

func (h *AdminHandler) HandleSaveSettings(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	keys := []string{"site_name", "telegram_url", "announcement", "logo_url"}
	for _, k := range keys {
		_ = h.catalogRepo.SetSetting(k, r.FormValue(k))
	}

	mmVal := "0"
	if r.FormValue("maintenance_mode") == "1" {
		mmVal = "1"
	}
	_ = h.catalogRepo.SetSetting("maintenance_mode", mmVal)

	http.Redirect(w, r, "/admin/settings", http.StatusSeeOther)
}

func (h *AdminHandler) HandleSaveSocial(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(r.FormValue("name"))
	urlStr := strings.TrimSpace(r.FormValue("url"))
	icon := strings.TrimSpace(r.FormValue("icon"))
	sortOrder, _ := strconv.Atoi(r.FormValue("sort_order"))

	if name != "" && urlStr != "" {
		if icon == "" {
			icon = "fas fa-link"
		}
		_ = h.catalogRepo.SaveSocialLink(&repo.SocialLink{
			Name:      name,
			URL:       urlStr,
			Icon:      icon,
			SortOrder: sortOrder,
		})
	}

	http.Redirect(w, r, "/admin/settings", http.StatusSeeOther)
}

func (h *AdminHandler) HandleDeleteSocial(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id != "" {
		_ = h.catalogRepo.DeleteSocialLink(id)
	}
	http.Redirect(w, r, "/admin/settings", http.StatusSeeOther)
}

func (h *AdminHandler) HandleNotify(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	title := strings.TrimSpace(r.FormValue("title"))
	msg := strings.TrimSpace(r.FormValue("message"))
	link := strings.TrimSpace(r.FormValue("link"))

	if title != "" && msg != "" {
		_ = h.catalogRepo.SaveNotification(&repo.Notification{
			Title:   title,
			Message: msg,
			Link:    link,
		})
	}

	http.Redirect(w, r, "/admin/settings", http.StatusSeeOther)
}

func (h *AdminHandler) HandleDeleteNotification(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id != "" {
		_ = h.catalogRepo.DeleteNotification(id)
	}
	http.Redirect(w, r, "/admin/settings", http.StatusSeeOther)
}

// -----------------------------------------------------------------------------
// Server & Workers Cluster
// -----------------------------------------------------------------------------

type WorkerViewModel struct {
	repo.WorkerInfo
	LastSeenFormatted string
}

func (h *AdminHandler) HandleServerView(w http.ResponseWriter, r *http.Request) {
	adminUID, _ := r.Context().Value(auth.AdminUIDKey).(string)
	csrfToken := h.adminMgr.GenerateCSRFToken(adminUID)
	brokenLinks, _ := h.userRepo.ListBrokenLinks("open", "all", "")

	workersList, _ := h.userRepo.ListWorkers()
	var workers []WorkerViewModel
	for _, wItem := range workersList {
		wvm := WorkerViewModel{WorkerInfo: wItem}
		if wItem.LastSeen > 0 {
			wvm.LastSeenFormatted = time.UnixMilli(wItem.LastSeen).Format("2006-01-02 15:04")
		} else {
			wvm.LastSeenFormatted = "Never"
		}
		workers = append(workers, wvm)
	}

	data := map[string]any{
		"Title":              "Server & Replication Cluster",
		"ActiveNav":          "server",
		"Role":               h.cfg.Role,
		"Port":               h.cfg.Port,
		"DBPath":             h.cfg.DBPath(),
		"TelegramConfigured": h.cfg.TgAPIHash != "" && h.cfg.TgChatID != "",
		"AdminUID":           adminUID,
		"CSRFToken":          csrfToken,
		"LiveOnline":         h.presence.LiveCount(),
		"BrokenLinksCount":   len(brokenLinks),
		"Workers":            workers,
		"NewWorkerKey":       r.URL.Query().Get("new_key"),
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = h.tmplMap["server.html"].ExecuteTemplate(w, "layout", data)
}

func (h *AdminHandler) HandleAddWorker(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(r.FormValue("name"))
	urlStr := strings.TrimSpace(r.FormValue("url"))
	if name == "" {
		http.Redirect(w, r, "/admin/server?error=Worker+name+is+required", http.StatusSeeOther)
		return
	}

	// Generate 32-byte secure hex key
	keyBytes := make([]byte, 24)
	_, _ = rand.Read(keyBytes)
	plainKey := hex.EncodeToString(keyBytes)

	hash := sha256.Sum256([]byte(plainKey))
	keyHash := hex.EncodeToString(hash[:])

	worker := &repo.WorkerInfo{
		Name:     name,
		KeyHash:  keyHash,
		URL:      urlStr,
		Created:  time.Now().UnixMilli(),
		LastSeen: 0,
		LastSeq:  0,
	}

	if err := h.userRepo.SaveWorker(worker); err != nil {
		http.Error(w, "Failed to save worker: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Redirect and display the key ONCE to admin
	http.Redirect(w, r, "/admin/server?new_key="+plainKey, http.StatusSeeOther)
}

func (h *AdminHandler) HandleDeleteWorker(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id != "" {
		_ = h.userRepo.DeleteWorker(id)
	}
	http.Redirect(w, r, "/admin/server", http.StatusSeeOther)
}

func (h *AdminHandler) HandleManualBackup(w http.ResponseWriter, r *http.Request) {
	if h.backupFn != nil {
		if err := h.backupFn(); err != nil {
			http.Redirect(w, r, "/admin/server?error="+url.QueryEscape("Backup failed: "+err.Error()), http.StatusSeeOther)
			return
		}
	} else if h.db != nil {
		if _, err := backup.RunBackup(h.cfg, h.db); err != nil {
			http.Redirect(w, r, "/admin/server?error="+url.QueryEscape("Backup failed: "+err.Error()), http.StatusSeeOther)
			return
		}
	}
	http.Redirect(w, r, "/admin/server?success=Database+backup+completed+successfully", http.StatusSeeOther)
}
