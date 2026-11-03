-- MoveX Initial Relational Schema

-- ============================================================================
-- 1. PUBLIC CATALOG TABLES (Replicated to worker nodes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS movies (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'movie', -- 'movie' or 'series'
    poster_url TEXT,
    backdrop_url TEXT,
    year INTEGER,
    rating REAL DEFAULT 0,
    overview TEXT,
    language TEXT,
    country TEXT,
    industry TEXT,
    genres TEXT, -- comma-separated genres for fast indexing
    views INTEGER NOT NULL DEFAULT 0,
    is_featured INTEGER NOT NULL DEFAULT 0,
    is_private INTEGER NOT NULL DEFAULT 0,
    is_upcoming INTEGER NOT NULL DEFAULT 0,
    release_date TEXT,
    release_ts INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_movies_type ON movies(content_type);
CREATE INDEX IF NOT EXISTS idx_movies_private ON movies(is_private);
CREATE INDEX IF NOT EXISTS idx_movies_featured ON movies(is_featured);
CREATE INDEX IF NOT EXISTS idx_movies_upcoming ON movies(is_upcoming);
CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(year);
CREATE INDEX IF NOT EXISTS idx_movies_updated ON movies(updated_at);

CREATE TABLE IF NOT EXISTS seasons (
    id TEXT PRIMARY KEY,
    movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    title TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_seasons_movie ON seasons(movie_id, season_number);

CREATE TABLE IF NOT EXISTS episodes (
    id TEXT PRIMARY KEY,
    season_id TEXT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    episode_number INTEGER NOT NULL,
    title TEXT,
    duration TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_episodes_season ON episodes(season_id, episode_number);
CREATE INDEX IF NOT EXISTS idx_episodes_movie ON episodes(movie_id);

CREATE TABLE IF NOT EXISTS stream_links (
    id TEXT PRIMARY KEY,
    movie_id TEXT REFERENCES movies(id) ON DELETE CASCADE,
    episode_id TEXT REFERENCES episodes(id) ON DELETE CASCADE,
    server_type TEXT NOT NULL,
    url TEXT NOT NULL,
    label TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stream_movie ON stream_links(movie_id);
CREATE INDEX IF NOT EXISTS idx_stream_episode ON stream_links(episode_id);

CREATE TABLE IF NOT EXISTS download_links (
    id TEXT PRIMARY KEY,
    movie_id TEXT REFERENCES movies(id) ON DELETE CASCADE,
    episode_id TEXT REFERENCES episodes(id) ON DELETE CASCADE,
    quality TEXT,
    size TEXT,
    url TEXT NOT NULL,
    label TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_download_movie ON download_links(movie_id);
CREATE INDEX IF NOT EXISTS idx_download_episode ON download_links(episode_id);

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS movie_categories (
    movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, category_id)
);

CREATE TABLE IF NOT EXISTS banners (
    id TEXT PRIMARY KEY,
    title TEXT,
    image_url TEXT NOT NULL,
    link_url TEXT,
    movie_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(active, sort_order);

CREATE TABLE IF NOT EXISTS social_links (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    icon TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- ============================================================================
-- 2. MAIN-ONLY OPERATIONAL & USER TABLES (Never replicated to workers)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    uid TEXT PRIMARY KEY,
    email TEXT,
    name TEXT,
    avatar TEXT,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'frozen', 'deleted'
    created_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL DEFAULT 0,
    last_login_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen);

CREATE TABLE IF NOT EXISTS my_list (
    uid TEXT NOT NULL,
    movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    added_at INTEGER NOT NULL,
    PRIMARY KEY (uid, movie_id)
);
CREATE INDEX IF NOT EXISTS idx_my_list_uid ON my_list(uid, added_at DESC);

CREATE TABLE IF NOT EXISTS watch_progress (
    uid TEXT NOT NULL,
    movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    episode_id TEXT NOT NULL DEFAULT '',
    t REAL NOT NULL,
    d REAL NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (uid, movie_id, episode_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_uid ON watch_progress(uid, updated_at DESC);

CREATE TABLE IF NOT EXISTS broken_links (
    id TEXT PRIMARY KEY,
    movie_id TEXT NOT NULL,
    title TEXT NOT NULL,
    poster_url TEXT,
    type TEXT NOT NULL,
    ep_info TEXT NOT NULL,
    server_type TEXT NOT NULL,
    reporter_uid TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'fixed', 'ignored'
    reported_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_broken_status ON broken_links(status, reported_at DESC);

CREATE TABLE IF NOT EXISTS error_logs (
    id TEXT PRIMARY KEY,
    uid TEXT,
    message TEXT NOT NULL,
    stack TEXT,
    client_info TEXT,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS search_stats (
    term TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 1,
    last_searched_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_search_stats_count ON search_stats(count DESC);

CREATE TABLE IF NOT EXISTS site_stats (
    movie_id TEXT NOT NULL,
    kind TEXT NOT NULL, -- 'plays', 'lists'
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (movie_id, kind)
);

CREATE TABLE IF NOT EXISTS pwd_reset_attempts (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    ip TEXT NOT NULL,
    attempted_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pwd_attempts ON pwd_reset_attempts(email, attempted_at);

CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    admin_uid TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS workers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    url TEXT,
    created INTEGER NOT NULL,
    last_seen INTEGER NOT NULL DEFAULT 0,
    last_seq INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS meta (
    k TEXT PRIMARY KEY,
    v TEXT
);

-- ============================================================================
-- 3. REPLICATION CHANGES LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS changes (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    tbl TEXT NOT NULL,
    row_id TEXT NOT NULL,
    op TEXT NOT NULL, -- 'upsert' or 'delete'
    data TEXT,        -- full row JSON for upsert, null for delete
    ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_changes_seq ON changes(seq);
