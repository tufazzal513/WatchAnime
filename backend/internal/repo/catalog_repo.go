package repo

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type CatalogRepo struct {
	db *sql.DB
}

func NewCatalogRepo(db *sql.DB) *CatalogRepo {
	return &CatalogRepo{db: db}
}

// -----------------------------------------------------------------------------
// Categories
// -----------------------------------------------------------------------------

func (r *CatalogRepo) ListCategories() ([]Category, error) {
	rows, err := r.db.Query("SELECT id, name, sort_order, created_at FROM categories ORDER BY sort_order ASC, name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Category
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.Name, &c.SortOrder, &c.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, nil
}

func (r *CatalogRepo) SaveCategory(c *Category) error {
	now := time.Now().UnixMilli()
	if c.ID == "" {
		c.ID = uuid.NewString()
		c.CreatedAt = now
	}

	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var existingID string
	err = tx.QueryRow("SELECT id FROM categories WHERE name = ?", c.Name).Scan(&existingID)
	if err == nil && existingID != "" {
		c.ID = existingID
		_, err = tx.Exec("UPDATE categories SET sort_order = ? WHERE id = ?", c.SortOrder, c.ID)
		if err != nil {
			return err
		}
	} else {
		_, err = tx.Exec(`
			INSERT INTO categories (id, name, sort_order, created_at)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET name=excluded.name, sort_order=excluded.sort_order`,
			c.ID, c.Name, c.SortOrder, c.CreatedAt,
		)
		if err != nil {
			return err
		}
	}

	data, _ := json.Marshal(c)
	_, _ = tx.Exec("INSERT INTO changes (tbl, row_id, op, data, ts) VALUES ('categories', ?, 'upsert', ?, ?)", c.ID, string(data), now)
	return tx.Commit()
}

func (r *CatalogRepo) DeleteCategory(id string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec("DELETE FROM categories WHERE id = ?", id); err != nil {
		return err
	}
	now := time.Now().UnixMilli()
	_, _ = tx.Exec("INSERT INTO changes (tbl, row_id, op, data, ts) VALUES ('categories', ?, 'delete', NULL, ?)", id, now)
	return tx.Commit()
}

// -----------------------------------------------------------------------------
// Banners
// -----------------------------------------------------------------------------

func (r *CatalogRepo) ListBanners(activeOnly bool) ([]Banner, error) {
	query := "SELECT id, title, image_url, link_url, movie_id, sort_order, active, created_at, updated_at FROM banners"
	if activeOnly {
		query += " WHERE active = 1"
	}
	query += " ORDER BY sort_order ASC, created_at DESC"

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Banner
	for rows.Next() {
		var b Banner
		var title, linkURL, movieID sql.NullString
		var activeInt int
		if err := rows.Scan(&b.ID, &title, &b.ImageURL, &linkURL, &movieID, &b.SortOrder, &activeInt, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, err
		}
		b.Title = title.String
		b.LinkURL = linkURL.String
		b.MovieID = movieID.String
		b.Active = activeInt == 1
		list = append(list, b)
	}
	return list, nil
}

func (r *CatalogRepo) SaveBanner(b *Banner) error {
	now := time.Now().UnixMilli()
	if b.ID == "" {
		b.ID = uuid.NewString()
		b.CreatedAt = now
	}
	b.UpdatedAt = now

	activeInt := 0
	if b.Active {
		activeInt = 1
	}

	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO banners (id, title, image_url, link_url, movie_id, sort_order, active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			title=excluded.title, image_url=excluded.image_url, link_url=excluded.link_url,
			movie_id=excluded.movie_id, sort_order=excluded.sort_order, active=excluded.active,
			updated_at=excluded.updated_at`,
		b.ID, b.Title, b.ImageURL, b.LinkURL, b.MovieID, b.SortOrder, activeInt, b.CreatedAt, b.UpdatedAt,
	)
	if err != nil {
		return err
	}

	data, _ := json.Marshal(b)
	_, _ = tx.Exec("INSERT INTO changes (tbl, row_id, op, data, ts) VALUES ('banners', ?, 'upsert', ?, ?)", b.ID, string(data), now)
	return tx.Commit()
}

func (r *CatalogRepo) DeleteBanner(id string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec("DELETE FROM banners WHERE id = ?", id); err != nil {
		return err
	}
	now := time.Now().UnixMilli()
	_, _ = tx.Exec("INSERT INTO changes (tbl, row_id, op, data, ts) VALUES ('banners', ?, 'delete', NULL, ?)", id, now)
	return tx.Commit()
}

// -----------------------------------------------------------------------------
// Social Links
// -----------------------------------------------------------------------------

func (r *CatalogRepo) ListSocialLinks() ([]SocialLink, error) {
	rows, err := r.db.Query("SELECT id, name, url, icon, sort_order, created_at FROM social_links ORDER BY sort_order ASC, name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []SocialLink
	for rows.Next() {
		var s SocialLink
		if err := rows.Scan(&s.ID, &s.Name, &s.URL, &s.Icon, &s.SortOrder, &s.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, nil
}

func (r *CatalogRepo) SaveSocialLink(s *SocialLink) error {
	now := time.Now().UnixMilli()
	if s.ID == "" {
		s.ID = uuid.NewString()
		s.CreatedAt = now
	}

	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO social_links (id, name, url, icon, sort_order, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET name=excluded.name, url=excluded.url, icon=excluded.icon, sort_order=excluded.sort_order`,
		s.ID, s.Name, s.URL, s.Icon, s.SortOrder, s.CreatedAt,
	)
	if err != nil {
		return err
	}

	data, _ := json.Marshal(s)
	_, _ = tx.Exec("INSERT INTO changes (tbl, row_id, op, data, ts) VALUES ('social_links', ?, 'upsert', ?, ?)", s.ID, string(data), now)
	return tx.Commit()
}

func (r *CatalogRepo) DeleteSocialLink(id string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec("DELETE FROM social_links WHERE id = ?", id); err != nil {
		return err
	}
	now := time.Now().UnixMilli()
	_, _ = tx.Exec("INSERT INTO changes (tbl, row_id, op, data, ts) VALUES ('social_links', ?, 'delete', NULL, ?)", id, now)
	return tx.Commit()
}

// -----------------------------------------------------------------------------
// Notifications
// -----------------------------------------------------------------------------

func (r *CatalogRepo) ListNotifications(limit int) ([]Notification, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := r.db.Query("SELECT id, title, message, link, created_at FROM notifications ORDER BY created_at DESC LIMIT ?", limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Notification
	for rows.Next() {
		var n Notification
		var link sql.NullString
		if err := rows.Scan(&n.ID, &n.Title, &n.Message, &link, &n.CreatedAt); err != nil {
			return nil, err
		}
		n.Link = link.String
		list = append(list, n)
	}
	return list, nil
}

func (r *CatalogRepo) SaveNotification(n *Notification) error {
	now := time.Now().UnixMilli()
	if n.ID == "" {
		n.ID = uuid.NewString()
	}
	if n.CreatedAt == 0 {
		n.CreatedAt = now
	}

	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO notifications (id, title, message, link, created_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET title=excluded.title, message=excluded.message, link=excluded.link`,
		n.ID, n.Title, n.Message, n.Link, n.CreatedAt,
	)
	if err != nil {
		return err
	}

	data, _ := json.Marshal(n)
	_, _ = tx.Exec("INSERT INTO changes (tbl, row_id, op, data, ts) VALUES ('notifications', ?, 'upsert', ?, ?)", n.ID, string(data), now)
	return tx.Commit()
}

func (r *CatalogRepo) DeleteNotification(id string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec("DELETE FROM notifications WHERE id = ?", id); err != nil {
		return err
	}
	now := time.Now().UnixMilli()
	_, _ = tx.Exec("INSERT INTO changes (tbl, row_id, op, data, ts) VALUES ('notifications', ?, 'delete', NULL, ?)", id, now)
	return tx.Commit()
}

// -----------------------------------------------------------------------------
// Settings
// -----------------------------------------------------------------------------

func (r *CatalogRepo) GetSetting(key string) (string, error) {
	var val string
	err := r.db.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&val)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return val, err
}

func (r *CatalogRepo) SetSetting(key, val string) error {
	now := time.Now().UnixMilli()
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO settings (key, value) VALUES (?, ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		key, val,
	)
	if err != nil {
		return err
	}

	payload, _ := json.Marshal(map[string]string{"key": key, "value": val})
	_, _ = tx.Exec("INSERT INTO changes (tbl, row_id, op, data, ts) VALUES ('settings', ?, 'upsert', ?, ?)", key, string(payload), now)
	return tx.Commit()
}

func (r *CatalogRepo) GetAllPublicSettings() (map[string]string, error) {
	rows, err := r.db.Query("SELECT key, value FROM settings")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[string]string)
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err == nil {
			out[k] = v
		}
	}
	return out, nil
}
