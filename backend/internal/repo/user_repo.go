package repo

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type UserRepo struct {
	db *sql.DB
}

func NewUserRepo(db *sql.DB) *UserRepo {
	return &UserRepo{db: db}
}

// -----------------------------------------------------------------------------
// Users
// -----------------------------------------------------------------------------

func (r *UserRepo) GetUser(uid string) (*User, error) {
	var u User
	var email, name, avatar sql.NullString
	err := r.db.QueryRow(`
		SELECT uid, email, name, avatar, status, created_at, last_seen, last_login_at
		FROM users WHERE uid = ?`, uid,
	).Scan(&u.UID, &email, &name, &avatar, &u.Status, &u.CreatedAt, &u.LastSeen, &u.LastLoginAt)
	if err != nil {
		return nil, err
	}
	u.Email = email.String
	u.Name = name.String
	u.Avatar = avatar.String
	return &u, nil
}

func (r *UserRepo) UpsertUser(u *User) error {
	now := time.Now().UnixMilli()
	if u.CreatedAt == 0 {
		u.CreatedAt = now
	}
	if u.Status == "" {
		u.Status = "active"
	}

	_, err := r.db.Exec(`
		INSERT INTO users (uid, email, name, avatar, status, created_at, last_seen, last_login_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(uid) DO UPDATE SET
			email = COALESCE(NULLIF(excluded.email, ''), users.email),
			name = COALESCE(NULLIF(excluded.name, ''), users.name),
			avatar = COALESCE(NULLIF(excluded.avatar, ''), users.avatar),
			last_seen = excluded.last_seen,
			last_login_at = excluded.last_login_at`,
		u.UID, u.Email, u.Name, u.Avatar, u.Status, u.CreatedAt, u.LastSeen, u.LastLoginAt,
	)
	return err
}

func (r *UserRepo) UpdateUserStatus(uid, status string) error {
	_, err := r.db.Exec("UPDATE users SET status = ? WHERE uid = ?", status, uid)
	return err
}

func (r *UserRepo) UpdateUserLastSeen(uid string, ts int64) error {
	_, err := r.db.Exec("UPDATE users SET last_seen = ? WHERE uid = ?", ts, uid)
	return err
}

func (r *UserRepo) ListUsers(search, statusFilter string, offset, limit int) ([]User, int, error) {
	where := []string{"1=1"}
	args := []any{}

	if search != "" {
		where = append(where, "(email LIKE ? OR name LIKE ? OR uid LIKE ?)")
		term := "%" + strings.TrimSpace(search) + "%"
		args = append(args, term, term, term)
	}

	if statusFilter != "" && statusFilter != "all" {
		where = append(where, "status = ?")
		args = append(args, statusFilter)
	}

	whereClause := strings.Join(where, " AND ")

	var total int
	countQuery := "SELECT COUNT(*) FROM users WHERE " + whereClause
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	if limit <= 0 {
		limit = 50
	}

	query := fmt.Sprintf(`
		SELECT uid, email, name, avatar, status, created_at, last_seen, last_login_at
		FROM users WHERE %s ORDER BY created_at DESC LIMIT %d OFFSET %d`,
		whereClause, limit, offset,
	)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []User
	for rows.Next() {
		var u User
		var email, name, avatar sql.NullString
		if err := rows.Scan(&u.UID, &email, &name, &avatar, &u.Status, &u.CreatedAt, &u.LastSeen, &u.LastLoginAt); err != nil {
			return nil, 0, err
		}
		u.Email = email.String
		u.Name = name.String
		u.Avatar = avatar.String
		list = append(list, u)
	}

	return list, total, nil
}

func (r *UserRepo) DeleteUserData(uid string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, _ = tx.Exec("DELETE FROM my_list WHERE uid = ?", uid)
	_, _ = tx.Exec("DELETE FROM watch_progress WHERE uid = ?", uid)
	_, err = tx.Exec("UPDATE users SET status = 'deleted' WHERE uid = ?", uid)
	if err != nil {
		return err
	}
	return tx.Commit()
}

// -----------------------------------------------------------------------------
// My List
// -----------------------------------------------------------------------------

func (r *UserRepo) AddToMyList(uid, movieID string) error {
	now := time.Now().UnixMilli()
	_, err := r.db.Exec(`
		INSERT INTO my_list (uid, movie_id, added_at)
		VALUES (?, ?, ?)
		ON CONFLICT(uid, movie_id) DO UPDATE SET added_at = excluded.added_at`,
		uid, movieID, now,
	)
	return err
}

func (r *UserRepo) RemoveFromMyList(uid, movieID string) error {
	_, err := r.db.Exec("DELETE FROM my_list WHERE uid = ? AND movie_id = ?", uid, movieID)
	return err
}

func (r *UserRepo) IsInMyList(uid, movieID string) (bool, error) {
	var count int
	err := r.db.QueryRow("SELECT COUNT(*) FROM my_list WHERE uid = ? AND movie_id = ?", uid, movieID).Scan(&count)
	return count > 0, err
}

func (r *UserRepo) GetMyList(uid string) ([]*Movie, error) {
	query := `
		SELECT m.id, m.title, m.content_type, m.poster_url, m.backdrop_url, m.year, m.rating,
		       m.overview, m.language, m.country, m.industry, m.genres, m.views,
		       m.is_featured, m.is_private, m.is_upcoming, m.release_date, m.release_ts,
		       m.created_at, m.updated_at
		FROM movies m
		JOIN my_list l ON m.id = l.movie_id
		WHERE l.uid = ?
		ORDER BY l.added_at DESC`

	rows, err := r.db.Query(query, uid)
	if err != nil {
		return nil, err
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
		list = append(list, &m)
	}
	return list, nil
}

// -----------------------------------------------------------------------------
// Watch Progress
// -----------------------------------------------------------------------------

func (r *UserRepo) SaveProgress(wp *WatchProgress) error {
	now := time.Now().UnixMilli()
	if wp.UpdatedAt == 0 {
		wp.UpdatedAt = now
	}
	_, err := r.db.Exec(`
		INSERT INTO watch_progress (uid, movie_id, episode_id, t, d, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(uid, movie_id, episode_id) DO UPDATE SET
			t = excluded.t,
			d = excluded.d,
			updated_at = excluded.updated_at`,
		wp.UID, wp.MovieID, wp.EpisodeID, wp.T, wp.D, wp.UpdatedAt,
	)
	return err
}

func (r *UserRepo) GetProgress(uid string) ([]WatchProgress, error) {
	rows, err := r.db.Query(`
		SELECT movie_id, episode_id, t, d, updated_at
		FROM watch_progress WHERE uid = ? ORDER BY updated_at DESC`, uid,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []WatchProgress
	for rows.Next() {
		var wp WatchProgress
		wp.UID = uid
		if err := rows.Scan(&wp.MovieID, &wp.EpisodeID, &wp.T, &wp.D, &wp.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, wp)
	}
	return list, nil
}

// -----------------------------------------------------------------------------
// Broken Links
// -----------------------------------------------------------------------------

func (r *UserRepo) ReportBrokenLink(bl *BrokenLink) error {
	now := time.Now().UnixMilli()
	if bl.ID == "" {
		bl.ID = uuid.NewString()
	}
	if bl.ReportedAt == 0 {
		bl.ReportedAt = now
	}
	if bl.Status == "" {
		bl.Status = "open"
	}

	_, err := r.db.Exec(`
		INSERT INTO broken_links (id, movie_id, title, poster_url, type, ep_info, server_type, reporter_uid, note, status, reported_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		bl.ID, bl.MovieID, bl.Title, bl.PosterURL, bl.Type, bl.EpInfo, bl.ServerType, bl.ReporterUID, bl.Note, bl.Status, bl.ReportedAt,
	)
	return err
}

func (r *UserRepo) ListBrokenLinks(status, typeFilter, search string) ([]BrokenLink, error) {
	where := []string{"1=1"}
	args := []any{}

	if status != "" && status != "all" {
		where = append(where, "status = ?")
		args = append(args, status)
	}

	if typeFilter != "" && typeFilter != "all" {
		where = append(where, "type = ?")
		args = append(args, typeFilter)
	}

	if search != "" {
		where = append(where, "(title LIKE ? OR ep_info LIKE ?)")
		term := "%" + strings.TrimSpace(search) + "%"
		args = append(args, term, term)
	}

	query := fmt.Sprintf(`
		SELECT id, movie_id, title, poster_url, type, ep_info, server_type, reporter_uid, note, status, reported_at
		FROM broken_links WHERE %s ORDER BY reported_at DESC`, strings.Join(where, " AND "))

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []BrokenLink
	for rows.Next() {
		var bl BrokenLink
		var poster, note, reporterUID sql.NullString
		if err := rows.Scan(
			&bl.ID, &bl.MovieID, &bl.Title, &poster, &bl.Type, &bl.EpInfo,
			&bl.ServerType, &reporterUID, &note, &bl.Status, &bl.ReportedAt,
		); err != nil {
			return nil, err
		}
		bl.PosterURL = poster.String
		bl.Note = note.String
		bl.ReporterUID = reporterUID.String
		list = append(list, bl)
	}
	return list, nil
}

func (r *UserRepo) UpdateBrokenLinkStatus(id, status string) error {
	_, err := r.db.Exec("UPDATE broken_links SET status = ? WHERE id = ?", status, id)
	return err
}

func (r *UserRepo) DeleteBrokenLink(id string) error {
	_, err := r.db.Exec("DELETE FROM broken_links WHERE id = ?", id)
	return err
}

// -----------------------------------------------------------------------------
// Error Logs
// -----------------------------------------------------------------------------

func (r *UserRepo) LogError(el *ErrorLog) error {
	now := time.Now().UnixMilli()
	if el.ID == "" {
		el.ID = uuid.NewString()
	}
	if el.CreatedAt == 0 {
		el.CreatedAt = now
	}

	// Limit message size to prevent log flooding (prompt specified ~4000 bytes max)
	if len(el.Message) > 4000 {
		el.Message = el.Message[:4000]
	}

	_, err := r.db.Exec(`
		INSERT INTO error_logs (id, uid, message, stack, client_info, created_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		el.ID, el.UID, el.Message, el.Stack, el.ClientInfo, el.CreatedAt,
	)
	return err
}

func (r *UserRepo) ListErrors(limit int) ([]ErrorLog, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := r.db.Query(`
		SELECT id, uid, message, stack, client_info, created_at
		FROM error_logs ORDER BY created_at DESC LIMIT ?`, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []ErrorLog
	for rows.Next() {
		var el ErrorLog
		var uid, stack, clientInfo sql.NullString
		if err := rows.Scan(&el.ID, &uid, &el.Message, &stack, &clientInfo, &el.CreatedAt); err != nil {
			return nil, err
		}
		el.UID = uid.String
		el.Stack = stack.String
		el.ClientInfo = clientInfo.String
		list = append(list, el)
	}
	return list, nil
}

// -----------------------------------------------------------------------------
// Search Stats
// -----------------------------------------------------------------------------

func (r *UserRepo) RecordSearchHit(term string) error {
	term = strings.TrimSpace(term)
	if len(term) < 2 || len(term) > 50 {
		return nil
	}
	now := time.Now().UnixMilli()
	_, err := r.db.Exec(`
		INSERT INTO search_stats (term, count, last_searched_at)
		VALUES (?, 1, ?)
		ON CONFLICT(term) DO UPDATE SET
			count = count + 1,
			last_searched_at = excluded.last_searched_at`,
		term, now,
	)
	return err
}

func (r *UserRepo) GetSearchSuggestions(q string, limit int) ([]SearchStat, error) {
	if limit <= 0 {
		limit = 10
	}
	query := "SELECT term, count, last_searched_at FROM search_stats"
	var rows *sql.Rows
	var err error
	if q != "" {
		query += " WHERE term LIKE ? ORDER BY count DESC LIMIT ?"
		rows, err = r.db.Query(query, "%"+strings.TrimSpace(q)+"%", limit)
	} else {
		query += " ORDER BY count DESC LIMIT ?"
		rows, err = r.db.Query(query, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []SearchStat
	for rows.Next() {
		var s SearchStat
		if err := rows.Scan(&s.Term, &s.Count, &s.LastSearchedAt); err == nil {
			list = append(list, s)
		}
	}
	return list, nil
}

// -----------------------------------------------------------------------------
// Workers & Meta
// -----------------------------------------------------------------------------

func (r *UserRepo) SaveWorker(w *WorkerInfo) error {
	if w.ID == "" {
		w.ID = uuid.NewString()
	}
	if w.Created == 0 {
		w.Created = time.Now().UnixMilli()
	}
	_, err := r.db.Exec(`
		INSERT INTO workers (id, name, key_hash, url, created, last_seen, last_seq)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name = excluded.name,
			url = excluded.url,
			last_seen = excluded.last_seen,
			last_seq = excluded.last_seq`,
		w.ID, w.Name, w.KeyHash, w.URL, w.Created, w.LastSeen, w.LastSeq,
	)
	return err
}

func (r *UserRepo) ListWorkers() ([]WorkerInfo, error) {
	rows, err := r.db.Query("SELECT id, name, key_hash, url, created, last_seen, last_seq FROM workers ORDER BY created DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []WorkerInfo
	for rows.Next() {
		var w WorkerInfo
		var url sql.NullString
		if err := rows.Scan(&w.ID, &w.Name, &w.KeyHash, &url, &w.Created, &w.LastSeen, &w.LastSeq); err == nil {
			w.URL = url.String
			list = append(list, w)
		}
	}
	return list, nil
}

func (r *UserRepo) DeleteWorker(id string) error {
	_, err := r.db.Exec("DELETE FROM workers WHERE id = ?", id)
	return err
}

func (r *UserRepo) GetWorkerByKeyHash(keyHash string) (*WorkerInfo, error) {
	var w WorkerInfo
	var url sql.NullString
	err := r.db.QueryRow(
		"SELECT id, name, key_hash, url, created, last_seen, last_seq FROM workers WHERE key_hash = ?",
		keyHash,
	).Scan(&w.ID, &w.Name, &w.KeyHash, &url, &w.Created, &w.LastSeen, &w.LastSeq)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	w.URL = url.String
	return &w, nil
}

func (r *UserRepo) UpdateWorkerHeartbeat(keyHash, url string, lastSeq int64) error {
	now := time.Now().UnixMilli()
	if url != "" {
		_, err := r.db.Exec(`
			UPDATE workers
			SET last_seen = ?, url = ?, last_seq = CASE WHEN ? > last_seq THEN ? ELSE last_seq END
			WHERE key_hash = ?`,
			now, url, lastSeq, lastSeq, keyHash,
		)
		return err
	}
	_, err := r.db.Exec(`
		UPDATE workers
		SET last_seen = ?, last_seq = CASE WHEN ? > last_seq THEN ? ELSE last_seq END
		WHERE key_hash = ?`,
		now, lastSeq, lastSeq, keyHash,
	)
	return err
}

func (r *UserRepo) GetMeta(k string) (string, error) {
	var v string
	err := r.db.QueryRow("SELECT v FROM meta WHERE k = ?", k).Scan(&v)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return v, err
}

func (r *UserRepo) SetMeta(k, v string) error {
	_, err := r.db.Exec(`
		INSERT INTO meta (k, v) VALUES (?, ?)
		ON CONFLICT(k) DO UPDATE SET v = excluded.v`, k, v,
	)
	return err
}

// -----------------------------------------------------------------------------
// Replication Changes
// -----------------------------------------------------------------------------

func (r *UserRepo) GetChanges(sinceSeq int64, limit int) ([]ChangeItem, int64, bool, error) {
	if limit <= 0 {
		limit = 1000
	}
	rows, err := r.db.Query(`
		SELECT seq, tbl, row_id, op, data, ts
		FROM changes WHERE seq > ? ORDER BY seq ASC LIMIT ?`,
		sinceSeq, limit+1,
	)
	if err != nil {
		return nil, 0, false, err
	}
	defer rows.Close()

	var list []ChangeItem
	var maxSeq int64 = sinceSeq
	for rows.Next() {
		var c ChangeItem
		var data sql.NullString
		if err := rows.Scan(&c.Seq, &c.Tbl, &c.RowID, &c.Op, &data, &c.TS); err != nil {
			return nil, 0, false, err
		}
		c.Data = data.String
		list = append(list, c)
		if c.Seq > maxSeq {
			maxSeq = c.Seq
		}
	}

	more := false
	if len(list) > limit {
		more = true
		list = list[:limit]
		maxSeq = list[len(list)-1].Seq
	}

	return list, maxSeq, more, nil
}

func (r *UserRepo) GetMaxSeq() (int64, error) {
	var seq sql.NullInt64
	err := r.db.QueryRow("SELECT MAX(seq) FROM changes").Scan(&seq)
	if err != nil {
		return 0, err
	}
	if !seq.Valid {
		return 0, nil
	}
	return seq.Int64, nil
}
