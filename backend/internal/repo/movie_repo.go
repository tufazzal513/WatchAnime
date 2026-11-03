package repo

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type MovieRepo struct {
	db *sql.DB
}

func NewMovieRepo(db *sql.DB) *MovieRepo {
	return &MovieRepo{db: db}
}

// SaveMovie saves a movie along with its categories, links, and seasons atomically.
func (r *MovieRepo) SaveMovie(
	m *Movie,
	categoryNames []string,
	streamLinks []StreamLink,
	downloadLinks []DownloadLink,
	seasons []SeasonWithEpisodes,
) error {
	now := time.Now().UnixMilli()
	if m.ID == "" {
		m.ID = uuid.NewString()
	}
	if m.CreatedAt == 0 {
		m.CreatedAt = now
	}
	m.UpdatedAt = now

	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// 1. Upsert movies table
	queryMovie := `
	INSERT INTO movies (
		id, title, content_type, poster_url, backdrop_url, year, rating,
		overview, language, country, industry, genres, views,
		is_featured, is_private, is_upcoming, release_date, release_ts,
		created_at, updated_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(id) DO UPDATE SET
		title = excluded.title,
		content_type = excluded.content_type,
		poster_url = excluded.poster_url,
		backdrop_url = excluded.backdrop_url,
		year = excluded.year,
		rating = excluded.rating,
		overview = excluded.overview,
		language = excluded.language,
		country = excluded.country,
		industry = excluded.industry,
		genres = excluded.genres,
		is_featured = excluded.is_featured,
		is_private = excluded.is_private,
		is_upcoming = excluded.is_upcoming,
		release_date = excluded.release_date,
		release_ts = excluded.release_ts,
		updated_at = excluded.updated_at;`

	isFeaturedInt := 0
	if m.IsFeatured {
		isFeaturedInt = 1
	}
	isPrivateInt := 0
	if m.IsPrivate {
		isPrivateInt = 1
	}
	isUpcomingInt := 0
	if m.IsUpcoming {
		isUpcomingInt = 1
	}

	_, err = tx.Exec(queryMovie,
		m.ID, m.Title, m.ContentType, m.PosterURL, m.BackdropURL, m.Year, m.Rating,
		m.Overview, m.Language, m.Country, m.Industry, m.Genres, m.Views,
		isFeaturedInt, isPrivateInt, isUpcomingInt, m.ReleaseDate, m.ReleaseTs,
		m.CreatedAt, m.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to upsert movie: %w", err)
	}

	// 2. Categories mapping
	_, _ = tx.Exec("DELETE FROM movie_categories WHERE movie_id = ?", m.ID)
	for _, catName := range categoryNames {
		catName = strings.TrimSpace(catName)
		if catName == "" {
			continue
		}
		var catID string
		err := tx.QueryRow("SELECT id FROM categories WHERE name = ?", catName).Scan(&catID)
		if err == sql.ErrNoRows {
			catID = uuid.NewString()
			_, err = tx.Exec("INSERT INTO categories (id, name, created_at) VALUES (?, ?, ?)", catID, catName, now)
			if err != nil {
				return fmt.Errorf("failed to insert category %s: %w", catName, err)
			}
		} else if err != nil {
			return fmt.Errorf("failed to query category: %w", err)
		}
		_, err = tx.Exec("INSERT OR IGNORE INTO movie_categories (movie_id, category_id) VALUES (?, ?)", m.ID, catID)
		if err != nil {
			return fmt.Errorf("failed to map movie category: %w", err)
		}
	}

	// 3. Movie-level stream & download links
	_, _ = tx.Exec("DELETE FROM stream_links WHERE movie_id = ? AND (episode_id IS NULL OR episode_id = '')", m.ID)
	for i, sl := range streamLinks {
		if sl.URL == "" {
			continue
		}
		slID := sl.ID
		if slID == "" {
			slID = uuid.NewString()
		}
		_, err = tx.Exec(`
			INSERT INTO stream_links (id, movie_id, episode_id, server_type, url, label, sort_order, created_at)
			VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
			slID, m.ID, sl.ServerType, sl.URL, sl.Label, i, now,
		)
		if err != nil {
			return fmt.Errorf("failed to insert stream link: %w", err)
		}
	}

	_, _ = tx.Exec("DELETE FROM download_links WHERE movie_id = ? AND (episode_id IS NULL OR episode_id = '')", m.ID)
	for i, dl := range downloadLinks {
		if dl.URL == "" {
			continue
		}
		dlID := dl.ID
		if dlID == "" {
			dlID = uuid.NewString()
		}
		_, err = tx.Exec(`
			INSERT INTO download_links (id, movie_id, episode_id, quality, size, url, label, sort_order, created_at)
			VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
			dlID, m.ID, dl.Quality, dl.Size, dl.URL, dl.Label, i, now,
		)
		if err != nil {
			return fmt.Errorf("failed to insert download link: %w", err)
		}
	}

	// 4. Seasons and Episodes
	if m.ContentType == "series" && len(seasons) > 0 {
		_, _ = tx.Exec("DELETE FROM seasons WHERE movie_id = ?", m.ID)
		for sIdx, s := range seasons {
			seasonID := s.ID
			if seasonID == "" {
				seasonID = uuid.NewString()
			}
			sNum := s.SeasonNumber
			if sNum == 0 {
				sNum = sIdx + 1
			}
			_, err = tx.Exec(`
				INSERT INTO seasons (id, movie_id, season_number, title, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?)`,
				seasonID, m.ID, sNum, s.Title, now, now,
			)
			if err != nil {
				return fmt.Errorf("failed to insert season: %w", err)
			}

			for eIdx, ep := range s.Episodes {
				epID := ep.ID
				if epID == "" {
					epID = uuid.NewString()
				}
				epNum := ep.EpisodeNumber
				if epNum == 0 {
					epNum = eIdx + 1
				}
				_, err = tx.Exec(`
					INSERT INTO episodes (id, season_id, movie_id, episode_number, title, duration, created_at, updated_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					epID, seasonID, m.ID, epNum, ep.Title, ep.Duration, now, now,
				)
				if err != nil {
					return fmt.Errorf("failed to insert episode: %w", err)
				}

				// Episode links
				for lIdx, sl := range ep.StreamLinks {
					if sl.URL == "" {
						continue
					}
					slID := sl.ID
					if slID == "" {
						slID = uuid.NewString()
					}
					_, err = tx.Exec(`
						INSERT INTO stream_links (id, movie_id, episode_id, server_type, url, label, sort_order, created_at)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
						slID, m.ID, epID, sl.ServerType, sl.URL, sl.Label, lIdx, now,
					)
					if err != nil {
						return fmt.Errorf("failed to insert ep stream link: %w", err)
					}
				}

				for lIdx, dl := range ep.DownloadLinks {
					if dl.URL == "" {
						continue
					}
					dlID := dl.ID
					if dlID == "" {
						dlID = uuid.NewString()
					}
					_, err = tx.Exec(`
						INSERT INTO download_links (id, movie_id, episode_id, quality, size, url, label, sort_order, created_at)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
						dlID, m.ID, epID, dl.Quality, dl.Size, dl.URL, dl.Label, lIdx, now,
					)
					if err != nil {
						return fmt.Errorf("failed to insert ep download link: %w", err)
					}
				}
			}
		}
	}

	// 5. Record replication change with full relations
	fullMovie := MovieFull{
		Movie:         *m,
		Categories:    categoryNames,
		StreamLinks:   streamLinks,
		DownloadLinks: downloadLinks,
		Seasons:       seasons,
	}
	movieData, _ := json.Marshal(fullMovie)
	_, err = tx.Exec(`
		INSERT INTO changes (tbl, row_id, op, data, ts)
		VALUES ('movies', ?, 'upsert', ?, ?)`,
		m.ID, string(movieData), now,
	)
	if err != nil {
		return fmt.Errorf("failed to log change: %w", err)
	}

	return tx.Commit()
}

// GetMovie retrieves basic movie metadata.
func (r *MovieRepo) GetMovie(id string) (*Movie, error) {
	query := `
	SELECT id, title, content_type, poster_url, backdrop_url, year, rating,
	       overview, language, country, industry, genres, views,
	       is_featured, is_private, is_upcoming, release_date, release_ts,
	       created_at, updated_at
	FROM movies WHERE id = ?`

	var m Movie
	var isFeatured, isPrivate, isUpcoming int
	var poster, backdrop, overview, lang, country, industry, genres, relDate sql.NullString

	err := r.db.QueryRow(query, id).Scan(
		&m.ID, &m.Title, &m.ContentType, &poster, &backdrop, &m.Year, &m.Rating,
		&overview, &lang, &country, &industry, &genres, &m.Views,
		&isFeatured, &isPrivate, &isUpcoming, &relDate, &m.ReleaseTs,
		&m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	m.PosterURL = poster.String
	m.BackdropURL = backdrop.String
	m.Overview = overview.String
	m.Language = lang.String
	m.Country = country.String
	m.Industry = industry.String
	m.Genres = genres.String
	m.ReleaseDate = relDate.String
	m.IsFeatured = isFeatured == 1
	m.IsPrivate = isPrivate == 1
	m.IsUpcoming = isUpcoming == 1

	return &m, nil
}

// GetMovieFull retrieves a movie with all its seasons, episodes, and stream/download links.
func (r *MovieRepo) GetMovieFull(id string) (*MovieFull, error) {
	m, err := r.GetMovie(id)
	if err != nil {
		return nil, err
	}

	full := &MovieFull{
		Movie:         *m,
		Categories:    []string{},
		StreamLinks:   []StreamLink{},
		DownloadLinks: []DownloadLink{},
		Seasons:       []SeasonWithEpisodes{},
	}

	// 1. Categories
	catRows, err := r.db.Query(`
		SELECT c.name FROM categories c
		JOIN movie_categories mc ON c.id = mc.category_id
		WHERE mc.movie_id = ? ORDER BY c.sort_order, c.name`, id)
	if err == nil {
		defer catRows.Close()
		for catRows.Next() {
			var catName string
			if err := catRows.Scan(&catName); err == nil {
				full.Categories = append(full.Categories, catName)
			}
		}
	}

	// 2. Movie-level stream links
	slRows, err := r.db.Query(`
		SELECT id, server_type, url, label, sort_order, created_at
		FROM stream_links
		WHERE movie_id = ? AND (episode_id IS NULL OR episode_id = '')
		ORDER BY sort_order, id`, id)
	if err == nil {
		defer slRows.Close()
		for slRows.Next() {
			var sl StreamLink
			var label sql.NullString
			if err := slRows.Scan(&sl.ID, &sl.ServerType, &sl.URL, &label, &sl.SortOrder, &sl.CreatedAt); err == nil {
				sl.MovieID = id
				sl.Label = label.String
				full.StreamLinks = append(full.StreamLinks, sl)
			}
		}
	}

	// 3. Movie-level download links
	dlRows, err := r.db.Query(`
		SELECT id, quality, size, url, label, sort_order, created_at
		FROM download_links
		WHERE movie_id = ? AND (episode_id IS NULL OR episode_id = '')
		ORDER BY sort_order, id`, id)
	if err == nil {
		defer dlRows.Close()
		for dlRows.Next() {
			var dl DownloadLink
			var quality, size, label sql.NullString
			if err := dlRows.Scan(&dl.ID, &quality, &size, &dl.URL, &label, &dl.SortOrder, &dl.CreatedAt); err == nil {
				dl.MovieID = id
				dl.Quality = quality.String
				dl.Size = size.String
				dl.Label = label.String
				full.DownloadLinks = append(full.DownloadLinks, dl)
			}
		}
	}

	// 4. Seasons and Episodes
	if m.ContentType == "series" {
		seasonRows, err := r.db.Query(`
			SELECT id, season_number, title, created_at, updated_at
			FROM seasons WHERE movie_id = ? ORDER BY season_number`, id)
		if err == nil {
			var rawSeasons []SeasonWithEpisodes
			for seasonRows.Next() {
				var s SeasonWithEpisodes
				var title sql.NullString
				if err := seasonRows.Scan(&s.ID, &s.SeasonNumber, &title, &s.CreatedAt, &s.UpdatedAt); err == nil {
					s.MovieID = id
					s.Title = title.String
					s.Episodes = []EpisodeWithLinks{}
					rawSeasons = append(rawSeasons, s)
				}
			}
			seasonRows.Close()

			for i := range rawSeasons {
				s := &rawSeasons[i]
				epRows, err := r.db.Query(`
					SELECT id, episode_number, title, duration, created_at, updated_at
					FROM episodes WHERE season_id = ? ORDER BY episode_number`, s.ID)
				if err == nil {
					var rawEpisodes []EpisodeWithLinks
					for epRows.Next() {
						var ep EpisodeWithLinks
						var epTitle, dur sql.NullString
						if err := epRows.Scan(&ep.ID, &ep.EpisodeNumber, &epTitle, &dur, &ep.CreatedAt, &ep.UpdatedAt); err == nil {
							ep.SeasonID = s.ID
							ep.MovieID = id
							ep.Title = epTitle.String
							ep.Duration = dur.String
							ep.StreamLinks = []StreamLink{}
							ep.DownloadLinks = []DownloadLink{}
							rawEpisodes = append(rawEpisodes, ep)
						}
					}
					epRows.Close()

					for j := range rawEpisodes {
						ep := &rawEpisodes[j]
						// Episode streams
						epSlRows, err := r.db.Query(`
							SELECT id, server_type, url, label, sort_order, created_at
							FROM stream_links WHERE episode_id = ? ORDER BY sort_order`, ep.ID)
						if err == nil {
							for epSlRows.Next() {
								var l StreamLink
								var lbl sql.NullString
								if err := epSlRows.Scan(&l.ID, &l.ServerType, &l.URL, &lbl, &l.SortOrder, &l.CreatedAt); err == nil {
									l.MovieID = id
									l.EpisodeID = ep.ID
									l.Label = lbl.String
									ep.StreamLinks = append(ep.StreamLinks, l)
								}
							}
							epSlRows.Close()
						}

						// Episode downloads
						epDlRows, err := r.db.Query(`
							SELECT id, quality, size, url, label, sort_order, created_at
							FROM download_links WHERE episode_id = ? ORDER BY sort_order`, ep.ID)
						if err == nil {
							for epDlRows.Next() {
								var l DownloadLink
								var q, sz, lbl sql.NullString
								if err := epDlRows.Scan(&l.ID, &q, &sz, &l.URL, &lbl, &l.SortOrder, &l.CreatedAt); err == nil {
									l.MovieID = id
									l.EpisodeID = ep.ID
									l.Quality = q.String
									l.Size = sz.String
									l.Label = lbl.String
									ep.DownloadLinks = append(ep.DownloadLinks, l)
								}
							}
							epDlRows.Close()
						}
					}
					s.Episodes = rawEpisodes
				}
				full.Seasons = append(full.Seasons, *s)
			}
		}
	}

	return full, nil
}

// ListMovies queries the catalog with flexible filtering and pagination.
func (r *MovieRepo) ListMovies(f MovieFilter) ([]*Movie, int, error) {
	where := []string{"1=1"}
	args := []any{}

	if f.ContentType != "" && f.ContentType != "all" {
		where = append(where, "content_type = ?")
		args = append(args, f.ContentType)
	}

	if f.IsPrivate != nil {
		if *f.IsPrivate {
			where = append(where, "is_private = 1")
		} else {
			where = append(where, "is_private = 0")
		}
	}

	if f.IsFeatured != nil {
		if *f.IsFeatured {
			where = append(where, "is_featured = 1")
		} else {
			where = append(where, "is_featured = 0")
		}
	}

	if f.IsUpcoming != nil {
		now := time.Now().UnixMilli()
		if *f.IsUpcoming {
			where = append(where, "(is_upcoming = 1 AND (release_ts > ? OR release_ts = 0))")
			args = append(args, now)
		} else {
			where = append(where, "(is_upcoming = 0 OR (is_upcoming = 1 AND release_ts <= ? AND release_ts > 0))")
			args = append(args, now)
		}
	}

	if f.Category != "" && f.Category != "all" {
		where = append(where, "(genres LIKE ? OR genres LIKE ? OR genres = ?)")
		args = append(args, "%"+f.Category+"%", "%"+f.Category+",%", f.Category)
	}

	if f.Industry != "" && f.Industry != "all" {
		where = append(where, "industry = ?")
		args = append(args, f.Industry)
	}

	if f.Language != "" && f.Language != "all" {
		where = append(where, "language LIKE ?")
		args = append(args, "%"+f.Language+"%")
	}

	if f.Year > 0 {
		where = append(where, "year = ?")
		args = append(args, f.Year)
	}

	if f.Query != "" {
		where = append(where, "(title LIKE ? OR overview LIKE ?)")
		searchTerm := "%" + strings.TrimSpace(f.Query) + "%"
		args = append(args, searchTerm, searchTerm)
	}

	whereClause := strings.Join(where, " AND ")

	// Total count
	var total int
	countQuery := "SELECT COUNT(*) FROM movies WHERE " + whereClause
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count movies: %w", err)
	}

	// Order by
	orderBy := "created_at DESC"
	switch f.SortBy {
	case "views":
		orderBy = "views DESC, created_at DESC"
	case "rating":
		orderBy = "rating DESC, created_at DESC"
	case "year":
		orderBy = "year DESC, created_at DESC"
	case "title":
		orderBy = "title ASC"
	case "oldest":
		orderBy = "created_at ASC"
	}

	limitClause := ""
	if f.Limit > 0 {
		limitClause = fmt.Sprintf(" LIMIT %d OFFSET %d", f.Limit, f.Offset)
	}

	query := `
	SELECT id, title, content_type, poster_url, backdrop_url, year, rating,
	       overview, language, country, industry, genres, views,
	       is_featured, is_private, is_upcoming, release_date, release_ts,
	       created_at, updated_at
	FROM movies WHERE ` + whereClause + " ORDER BY " + orderBy + limitClause

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list movies: %w", err)
	}
	defer rows.Close()

	var list []*Movie
	for rows.Next() {
		var m Movie
		var isFeatured, isPrivate, isUpcoming int
		var poster, backdrop, overview, lang, country, industry, genres, relDate sql.NullString

		err := rows.Scan(
			&m.ID, &m.Title, &m.ContentType, &poster, &backdrop, &m.Year, &m.Rating,
			&overview, &lang, &country, &industry, &genres, &m.Views,
			&isFeatured, &isPrivate, &isUpcoming, &relDate, &m.ReleaseTs,
			&m.CreatedAt, &m.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan movie: %w", err)
		}

		m.PosterURL = poster.String
		m.BackdropURL = backdrop.String
		m.Overview = overview.String
		m.Language = lang.String
		m.Country = country.String
		m.Industry = industry.String
		m.Genres = genres.String
		m.ReleaseDate = relDate.String
		m.IsFeatured = isFeatured == 1
		m.IsPrivate = isPrivate == 1
		m.IsUpcoming = isUpcoming == 1

		list = append(list, &m)
	}

	return list, total, nil
}

// DeleteMovie deletes a movie and its cascade relations, logging a delete change.
func (r *MovieRepo) DeleteMovie(id string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec("DELETE FROM movies WHERE id = ?", id); err != nil {
		return err
	}

	now := time.Now().UnixMilli()
	_, err = tx.Exec(`
		INSERT INTO changes (tbl, row_id, op, data, ts)
		VALUES ('movies', ?, 'delete', NULL, ?)`,
		id, now,
	)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// IncrementViews increments view count atomically.
func (r *MovieRepo) IncrementViews(id string) error {
	_, err := r.db.Exec("UPDATE movies SET views = views + 1 WHERE id = ?", id)
	return err
}
