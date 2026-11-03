package sync

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"movex/internal/config"
	"movex/internal/repo"
)

// StartWorkerDaemon starts the background replication poller on a worker node.
func StartWorkerDaemon(
	ctx context.Context,
	cfg *config.Config,
	db *sql.DB,
	userRepo *repo.UserRepo,
) {
	interval := time.Duration(cfg.SyncEverySec) * time.Second
	if interval < 5*time.Second {
		interval = 5 * time.Second
	}

	slog.Info("starting worker replication sync daemon", "main_url", cfg.MainURL, "interval", interval.String())

	go func() {
		client := &http.Client{Timeout: 30 * time.Second}
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		// Initial sync immediately
		runSyncIteration(client, cfg, db, userRepo)

		for {
			select {
			case <-ctx.Done():
				slog.Info("worker sync daemon stopped")
				return
			case <-ticker.C:
				for {
					hasMore := runSyncIteration(client, cfg, db, userRepo)
					if !hasMore {
						break
					}
					// If hasMore is true, immediately process next batch without waiting for ticker
					select {
					case <-ctx.Done():
						return
					default:
					}
				}
			}
		}
	}()
}

// runSyncIteration performs a single poll-and-apply cycle. Returns true if more changes are available.
func runSyncIteration(client *http.Client, cfg *config.Config, db *sql.DB, userRepo *repo.UserRepo) bool {
	// Read current last_seq from local meta table
	lastSeqStr, _ := userRepo.GetMeta("last_seq")
	var lastSeq int64 = 0
	if lastSeqStr != "" {
		if n, err := strconv.ParseInt(lastSeqStr, 10, 64); err == nil {
			lastSeq = n
		}
	}

	apiURL := fmt.Sprintf("%s/api/v1/sync/changes?since_seq=%d&limit=200", cfg.MainURL, lastSeq)
	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		slog.Error("failed to create replication request", "err", err)
		return false
	}

	req.Header.Set("X-Worker-Key", cfg.WorkerKey)
	if cfg.PublicURL != "" {
		req.Header.Set("X-Worker-URL", cfg.PublicURL)
	}

	resp, err := client.Do(req)
	if err != nil {
		slog.Warn("failed to reach main server for sync", "err", err, "main_url", cfg.MainURL)
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		slog.Warn("main server returned sync error", "status", resp.StatusCode, "body", string(body))
		return false
	}

	var syncResp SyncResponse
	if err := json.NewDecoder(resp.Body).Decode(&syncResp); err != nil {
		slog.Error("failed to decode sync response", "err", err)
		return false
	}

	if len(syncResp.Changes) == 0 {
		return false
	}

	// Apply changes inside transaction
	appliedCount, newSeq, err := ApplyChangesBatch(db, syncResp.Changes)
	if err != nil {
		slog.Error("failed to apply replicated changes batch", "err", err)
		return false
	}

	slog.Info("replicated changes applied successfully", "applied", appliedCount, "new_seq", newSeq)
	return syncResp.HasMore
}

// ApplyChangesBatch executes a slice of ChangeItems into the local database transactionally.
func ApplyChangesBatch(db *sql.DB, changes []repo.ChangeItem) (int, int64, error) {
	if len(changes) == 0 {
		return 0, 0, nil
	}

	tx, err := db.Begin()
	if err != nil {
		return 0, 0, fmt.Errorf("begin transaction failed: %w", err)
	}
	defer tx.Rollback()

	var lastSeq int64 = 0
	applied := 0

	for _, c := range changes {
		switch c.Tbl {
		case "movies":
			if err := applyMovieChange(tx, c); err != nil {
				return 0, 0, fmt.Errorf("apply movie change %d failed: %w", c.Seq, err)
			}
		case "categories":
			if err := applyCategoryChange(tx, c); err != nil {
				return 0, 0, fmt.Errorf("apply category change %d failed: %w", c.Seq, err)
			}
		case "banners":
			if err := applyBannerChange(tx, c); err != nil {
				return 0, 0, fmt.Errorf("apply banner change %d failed: %w", c.Seq, err)
			}
		case "social_links":
			if err := applySocialChange(tx, c); err != nil {
				return 0, 0, fmt.Errorf("apply social change %d failed: %w", c.Seq, err)
			}
		case "notifications":
			if err := applyNotificationChange(tx, c); err != nil {
				return 0, 0, fmt.Errorf("apply notification change %d failed: %w", c.Seq, err)
			}
		case "settings":
			if err := applySettingChange(tx, c); err != nil {
				return 0, 0, fmt.Errorf("apply setting change %d failed: %w", c.Seq, err)
			}
		}

		if c.Seq > lastSeq {
			lastSeq = c.Seq
		}
		applied++
	}

	// Persist last_seq in meta table
	if lastSeq > 0 {
		_, err := tx.Exec(`
			INSERT INTO meta (k, v) VALUES ('last_seq', ?)
			ON CONFLICT(k) DO UPDATE SET v = excluded.v`,
			strconv.FormatInt(lastSeq, 10),
		)
		if err != nil {
			return 0, 0, fmt.Errorf("failed to persist last_seq: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, 0, fmt.Errorf("commit failed: %w", err)
	}

	return applied, lastSeq, nil
}

func applyMovieChange(tx *sql.Tx, c repo.ChangeItem) error {
	if c.Op == "delete" {
		_, err := tx.Exec("DELETE FROM movies WHERE id = ?", c.RowID)
		return err
	}

	// Upsert movie
	var full repo.MovieFull
	if err := json.Unmarshal([]byte(c.Data), &full); err != nil {
		// Fallback: maybe just Movie struct
		var m repo.Movie
		if err2 := json.Unmarshal([]byte(c.Data), &m); err2 != nil {
			return err
		}
		full.Movie = m
	}

	m := &full.Movie
	isFeatured := 0
	if m.IsFeatured {
		isFeatured = 1
	}
	isPrivate := 0
	if m.IsPrivate {
		isPrivate = 1
	}
	isUpcoming := 0
	if m.IsUpcoming {
		isUpcoming = 1
	}

	_, err := tx.Exec(`
		INSERT INTO movies (
			id, title, content_type, poster_url, backdrop_url, year, rating,
			overview, language, country, industry, genres, views,
			is_featured, is_private, is_upcoming, release_date, release_ts,
			created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			title=excluded.title, content_type=excluded.content_type, poster_url=excluded.poster_url,
			backdrop_url=excluded.backdrop_url, year=excluded.year, rating=excluded.rating,
			overview=excluded.overview, language=excluded.language, country=excluded.country,
			industry=excluded.industry, genres=excluded.genres, views=excluded.views,
			is_featured=excluded.is_featured, is_private=excluded.is_private, is_upcoming=excluded.is_upcoming,
			release_date=excluded.release_date, release_ts=excluded.release_ts, updated_at=excluded.updated_at`,
		m.ID, m.Title, m.ContentType, m.PosterURL, m.BackdropURL, m.Year, m.Rating,
		m.Overview, m.Language, m.Country, m.Industry, m.Genres, m.Views,
		isFeatured, isPrivate, isUpcoming, m.ReleaseDate, m.ReleaseTs,
		m.CreatedAt, m.UpdatedAt,
	)
	if err != nil {
		return err
	}

	// Replace stream and download links for movie level
	_, _ = tx.Exec("DELETE FROM stream_links WHERE movie_id = ? AND (episode_id IS NULL OR episode_id = '')", m.ID)
	for i, sl := range full.StreamLinks {
		slID := sl.ID
		if slID == "" {
			slID = fmt.Sprintf("%s-sl-%d", m.ID, i)
		}
		_, _ = tx.Exec(`
			INSERT INTO stream_links (id, movie_id, episode_id, server_type, url, label, sort_order, created_at)
			VALUES (?, ?, '', ?, ?, ?, ?, ?)`,
			slID, m.ID, sl.ServerType, sl.URL, sl.Label, i, sl.CreatedAt,
		)
	}

	_, _ = tx.Exec("DELETE FROM download_links WHERE movie_id = ? AND (episode_id IS NULL OR episode_id = '')", m.ID)
	for i, dl := range full.DownloadLinks {
		dlID := dl.ID
		if dlID == "" {
			dlID = fmt.Sprintf("%s-dl-%d", m.ID, i)
		}
		_, _ = tx.Exec(`
			INSERT INTO download_links (id, movie_id, episode_id, quality, size, url, label, sort_order, created_at)
			VALUES (?, ?, '', ?, ?, ?, ?, ?, ?)`,
			dlID, m.ID, dl.Quality, dl.Size, dl.URL, dl.Label, i, dl.CreatedAt,
		)
	}

	// If seasons provided, replace seasons and episodes
	if len(full.Seasons) > 0 {
		_, _ = tx.Exec("DELETE FROM seasons WHERE movie_id = ?", m.ID)
		for _, s := range full.Seasons {
			_, _ = tx.Exec(`
				INSERT INTO seasons (id, movie_id, season_number, title, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?)`,
				s.ID, m.ID, s.SeasonNumber, s.Title, s.CreatedAt, s.UpdatedAt,
			)
			for _, ep := range s.Episodes {
				_, _ = tx.Exec(`
					INSERT INTO episodes (id, season_id, movie_id, episode_number, title, duration, created_at, updated_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					ep.ID, s.ID, m.ID, ep.EpisodeNumber, ep.Title, ep.Duration, ep.CreatedAt, ep.UpdatedAt,
				)
				for j, sl := range ep.StreamLinks {
					slID := sl.ID
					if slID == "" {
						slID = fmt.Sprintf("%s-sl-%d", ep.ID, j)
					}
					_, _ = tx.Exec(`
						INSERT INTO stream_links (id, movie_id, episode_id, server_type, url, label, sort_order, created_at)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
						slID, m.ID, ep.ID, sl.ServerType, sl.URL, sl.Label, j, sl.CreatedAt,
					)
				}
				for j, dl := range ep.DownloadLinks {
					dlID := dl.ID
					if dlID == "" {
						dlID = fmt.Sprintf("%s-dl-%d", ep.ID, j)
					}
					_, _ = tx.Exec(`
						INSERT INTO download_links (id, movie_id, episode_id, quality, size, url, label, sort_order, created_at)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
						dlID, m.ID, ep.ID, dl.Quality, dl.Size, dl.URL, dl.Label, j, dl.CreatedAt,
					)
				}
			}
		}
	}

	// Categories
	if len(full.Categories) > 0 {
		_, _ = tx.Exec("DELETE FROM movie_categories WHERE movie_id = ?", m.ID)
		for _, catName := range full.Categories {
			catName = strings.TrimSpace(catName)
			if catName == "" {
				continue
			}
			var catID string
			err := tx.QueryRow("SELECT id FROM categories WHERE name = ?", catName).Scan(&catID)
			if err != nil {
				catID = fmt.Sprintf("cat-%s", strings.ToLower(strings.ReplaceAll(catName, " ", "-")))
				_, _ = tx.Exec("INSERT OR IGNORE INTO categories (id, name, sort_order, created_at) VALUES (?, ?, 0, ?)", catID, catName, time.Now().UnixMilli())
			}
			_, _ = tx.Exec("INSERT OR IGNORE INTO movie_categories (movie_id, category_id) VALUES (?, ?)", m.ID, catID)
		}
	}

	return nil
}

func applyCategoryChange(tx *sql.Tx, c repo.ChangeItem) error {
	if c.Op == "delete" {
		_, err := tx.Exec("DELETE FROM categories WHERE id = ?", c.RowID)
		return err
	}

	var cat repo.Category
	if err := json.Unmarshal([]byte(c.Data), &cat); err != nil {
		return err
	}

	var existingID string
	err := tx.QueryRow("SELECT id FROM categories WHERE name = ?", cat.Name).Scan(&existingID)
	if err == nil && existingID != "" {
		_, err = tx.Exec("UPDATE categories SET sort_order = ? WHERE id = ?", cat.SortOrder, existingID)
		return err
	}

	_, err = tx.Exec(`
		INSERT INTO categories (id, name, sort_order, created_at)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET name = excluded.name, sort_order = excluded.sort_order`,
		cat.ID, cat.Name, cat.SortOrder, cat.CreatedAt,
	)
	return err
}

func applyBannerChange(tx *sql.Tx, c repo.ChangeItem) error {
	if c.Op == "delete" {
		_, err := tx.Exec("DELETE FROM banners WHERE id = ?", c.RowID)
		return err
	}

	var b repo.Banner
	if err := json.Unmarshal([]byte(c.Data), &b); err != nil {
		return err
	}

	activeInt := 0
	if b.Active {
		activeInt = 1
	}

	_, err := tx.Exec(`
		INSERT INTO banners (id, title, image_url, link_url, movie_id, sort_order, active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			title=excluded.title, image_url=excluded.image_url, link_url=excluded.link_url,
			movie_id=excluded.movie_id, sort_order=excluded.sort_order, active=excluded.active,
			updated_at=excluded.updated_at`,
		b.ID, b.Title, b.ImageURL, b.LinkURL, b.MovieID, b.SortOrder, activeInt, b.CreatedAt, b.UpdatedAt,
	)
	return err
}

func applySocialChange(tx *sql.Tx, c repo.ChangeItem) error {
	if c.Op == "delete" {
		_, err := tx.Exec("DELETE FROM social_links WHERE id = ?", c.RowID)
		return err
	}

	var s repo.SocialLink
	if err := json.Unmarshal([]byte(c.Data), &s); err != nil {
		return err
	}

	_, err := tx.Exec(`
		INSERT INTO social_links (id, name, url, icon, sort_order, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET name=excluded.name, url=excluded.url, icon=excluded.icon, sort_order=excluded.sort_order`,
		s.ID, s.Name, s.URL, s.Icon, s.SortOrder, s.CreatedAt,
	)
	return err
}

func applyNotificationChange(tx *sql.Tx, c repo.ChangeItem) error {
	if c.Op == "delete" {
		_, err := tx.Exec("DELETE FROM notifications WHERE id = ?", c.RowID)
		return err
	}

	var n repo.Notification
	if err := json.Unmarshal([]byte(c.Data), &n); err != nil {
		return err
	}

	_, err := tx.Exec(`
		INSERT INTO notifications (id, title, message, link, created_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET title=excluded.title, message=excluded.message, link=excluded.link`,
		n.ID, n.Title, n.Message, n.Link, n.CreatedAt,
	)
	return err
}

func applySettingChange(tx *sql.Tx, c repo.ChangeItem) error {
	if c.Op == "delete" {
		_, err := tx.Exec("DELETE FROM settings WHERE key = ?", c.RowID)
		return err
	}

	var s map[string]string
	if err := json.Unmarshal([]byte(c.Data), &s); err != nil {
		return err
	}

	key := s["key"]
	val := s["value"]
	if key == "" {
		key = c.RowID
	}

	_, err := tx.Exec(`
		INSERT INTO settings (key, value) VALUES (?, ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		key, val,
	)
	return err
}
