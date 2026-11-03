package repo

import (
	"testing"
	"time"

	"movex/internal/db"
)

func setupTestDB(t *testing.T) (*MovieRepo, *CatalogRepo, *UserRepo) {
	database, err := db.Open(":memory:")
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	return NewMovieRepo(database), NewCatalogRepo(database), NewUserRepo(database)
}

func TestMovieLifecycle(t *testing.T) {
	mRepo, _, uRepo := setupTestDB(t)

	movie := &Movie{
		Title:       "Attack on Titan",
		ContentType: "series",
		Year:        2013,
		Rating:      9.0,
		Industry:    "Japanese",
		Language:    "Japanese",
		Genres:      "Action, Dark Fantasy, Anime",
		IsFeatured:  true,
		ReleaseDate: "2013-04-07",
	}

	seasons := []SeasonWithEpisodes{
		{
			Season: Season{SeasonNumber: 1, Title: "Season 1"},
			Episodes: []EpisodeWithLinks{
				{
					Episode: Episode{EpisodeNumber: 1, Title: "To You, in 2000 Years", Duration: "24m"},
					StreamLinks: []StreamLink{
						{ServerType: "VIDEASY", URL: "https://videasy.net/ep1", Label: "Fast Stream"},
					},
					DownloadLinks: []DownloadLink{
						{Quality: "1080p", Size: "450MB", URL: "https://downloads.example.com/ep1.mkv", Label: "Direct"},
					},
				},
			},
		},
	}

	err := mRepo.SaveMovie(movie, []string{"Action", "Anime"}, nil, nil, seasons)
	if err != nil {
		t.Fatalf("failed to save movie: %v", err)
	}

	if movie.ID == "" {
		t.Fatalf("expected movie ID to be assigned")
	}

	// Fetch full movie
	full, err := mRepo.GetMovieFull(movie.ID)
	if err != nil {
		t.Fatalf("failed to get full movie: %v", err)
	}

	if full.Title != "Attack on Titan" {
		t.Errorf("expected title 'Attack on Titan', got %q", full.Title)
	}
	if len(full.Categories) != 2 {
		t.Errorf("expected 2 categories, got %d", len(full.Categories))
	}
	if len(full.Seasons) != 1 {
		t.Fatalf("expected 1 season, got %d", len(full.Seasons))
	}
	if len(full.Seasons[0].Episodes) != 1 {
		t.Fatalf("expected 1 episode, got %d", len(full.Seasons[0].Episodes))
	}
	if len(full.Seasons[0].Episodes[0].StreamLinks) != 1 {
		t.Errorf("expected 1 stream link, got %d", len(full.Seasons[0].Episodes[0].StreamLinks))
	}

	// Filter movies
	list, total, err := mRepo.ListMovies(MovieFilter{
		ContentType: "series",
		Category:    "Action",
		Query:       "Titan",
	})
	if err != nil {
		t.Fatalf("failed to list movies: %v", err)
	}
	if total != 1 || len(list) != 1 {
		t.Errorf("expected 1 movie in list, got %d (total %d)", len(list), total)
	}

	// Increment views
	if err := mRepo.IncrementViews(movie.ID); err != nil {
		t.Errorf("failed to increment views: %v", err)
	}
	mUpdated, _ := mRepo.GetMovie(movie.ID)
	if mUpdated.Views != 1 {
		t.Errorf("expected views to be 1, got %d", mUpdated.Views)
	}

	// Verify changes log recorded upsert
	changes, maxSeq, more, err := uRepo.GetChanges(0, 10)
	if err != nil {
		t.Fatalf("failed to get changes: %v", err)
	}
	if len(changes) == 0 || maxSeq == 0 || more {
		t.Errorf("expected changes to be recorded, got %d items, maxSeq=%d", len(changes), maxSeq)
	}

	// Delete movie
	if err := mRepo.DeleteMovie(movie.ID); err != nil {
		t.Fatalf("failed to delete movie: %v", err)
	}
	_, err = mRepo.GetMovie(movie.ID)
	if err == nil {
		t.Errorf("expected movie to be deleted")
	}
}

func TestCatalogRepo(t *testing.T) {
	_, catRepo, _ := setupTestDB(t)

	// Categories
	cat := &Category{Name: "Sci-Fi", SortOrder: 1}
	if err := catRepo.SaveCategory(cat); err != nil {
		t.Fatalf("failed to save category: %v", err)
	}
	cats, err := catRepo.ListCategories()
	if err != nil || len(cats) != 1 {
		t.Fatalf("expected 1 category, got %d, err=%v", len(cats), err)
	}

	// Banners
	banner := &Banner{
		Title:    "Top Banner",
		ImageURL: "https://example.com/banner.jpg",
		Active:   true,
	}
	if err := catRepo.SaveBanner(banner); err != nil {
		t.Fatalf("failed to save banner: %v", err)
	}
	banners, err := catRepo.ListBanners(true)
	if err != nil || len(banners) != 1 {
		t.Fatalf("expected 1 banner, got %d, err=%v", len(banners), err)
	}

	// Social Links
	social := &SocialLink{Name: "Telegram", URL: "https://t.me/movex", Icon: "fab fa-telegram"}
	if err := catRepo.SaveSocialLink(social); err != nil {
		t.Fatalf("failed to save social link: %v", err)
	}
	socials, err := catRepo.ListSocialLinks()
	if err != nil || len(socials) != 1 {
		t.Fatalf("expected 1 social link, got %d, err=%v", len(socials), err)
	}

	// Settings
	if err := catRepo.SetSetting("site_name", "MoveX"); err != nil {
		t.Fatalf("failed to set setting: %v", err)
	}
	val, err := catRepo.GetSetting("site_name")
	if err != nil || val != "MoveX" {
		t.Fatalf("expected 'MoveX', got %q, err=%v", val, err)
	}
}

func TestUserRepo(t *testing.T) {
	mRepo, _, uRepo := setupTestDB(t)

	// Create Movie for MyList and Progress
	movie := &Movie{Title: "Demon Slayer", ContentType: "movie", Year: 2020}
	_ = mRepo.SaveMovie(movie, nil, nil, nil, nil)

	// User Upsert
	user := &User{
		UID:      "user-123",
		Email:    "user@example.com",
		Name:     "Tanjirou",
		LastSeen: time.Now().UnixMilli(),
	}
	if err := uRepo.UpsertUser(user); err != nil {
		t.Fatalf("failed to upsert user: %v", err)
	}

	u, err := uRepo.GetUser("user-123")
	if err != nil || u.Name != "Tanjirou" {
		t.Fatalf("expected user 'Tanjirou', got %v, err=%v", u, err)
	}

	// MyList
	if err := uRepo.AddToMyList("user-123", movie.ID); err != nil {
		t.Fatalf("failed to add to my list: %v", err)
	}
	inList, err := uRepo.IsInMyList("user-123", movie.ID)
	if err != nil || !inList {
		t.Fatalf("expected movie to be in my list")
	}
	list, err := uRepo.GetMyList("user-123")
	if err != nil || len(list) != 1 {
		t.Fatalf("expected 1 movie in list, got %d, err=%v", len(list), err)
	}

	// Watch Progress
	progress := &WatchProgress{
		UID:       "user-123",
		MovieID:   movie.ID,
		EpisodeID: "",
		T:         120.5,
		D:         1420.0,
	}
	if err := uRepo.SaveProgress(progress); err != nil {
		t.Fatalf("failed to save progress: %v", err)
	}
	progs, err := uRepo.GetProgress("user-123")
	if err != nil || len(progs) != 1 || progs[0].T != 120.5 {
		t.Fatalf("expected progress t=120.5, got %+v", progs)
	}

	// Broken Link
	bl := &BrokenLink{
		MovieID:    movie.ID,
		Title:      movie.Title,
		Type:       "movie",
		EpInfo:     "Main",
		ServerType: "VIDEASY",
	}
	if err := uRepo.ReportBrokenLink(bl); err != nil {
		t.Fatalf("failed to report broken link: %v", err)
	}
	bls, err := uRepo.ListBrokenLinks("open", "all", "")
	if err != nil || len(bls) != 1 {
		t.Fatalf("expected 1 broken link, got %d, err=%v", len(bls), err)
	}

	// Search Hit
	if err := uRepo.RecordSearchHit("Demon Slayer"); err != nil {
		t.Fatalf("failed to record search hit: %v", err)
	}
	suggestions, err := uRepo.GetSearchSuggestions("Demon", 5)
	if err != nil || len(suggestions) != 1 {
		t.Fatalf("expected 1 search suggestion, got %d", len(suggestions))
	}
}
