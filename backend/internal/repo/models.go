package repo

// Movie represents a catalog movie or series item.
type Movie struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	ContentType string  `json:"contentType"` // "movie" or "series"
	PosterURL   string  `json:"posterUrl"`
	BackdropURL string  `json:"backdropUrl"`
	Year        int     `json:"year"`
	Rating      float64 `json:"rating"`
	Overview    string  `json:"overview"`
	Language    string  `json:"language"`
	Country     string  `json:"country"`
	Industry    string  `json:"industry"`
	Genres      string  `json:"genres"` // comma-separated e.g. "Action, Drama"
	Views       int     `json:"views"`
	IsFeatured  bool    `json:"isFeatured"`
	IsPrivate   bool    `json:"isPrivate"`
	IsUpcoming  bool    `json:"isUpcoming"`
	ReleaseDate string  `json:"releaseDate"`
	ReleaseTs   int64   `json:"releaseTs"`
	CreatedAt   int64   `json:"createdAt"`
	UpdatedAt   int64   `json:"updatedAt"`
}

// Season represents a series season.
type Season struct {
	ID           string `json:"id"`
	MovieID      string `json:"movieId"`
	SeasonNumber int    `json:"seasonNumber"`
	Title        string `json:"title"`
	CreatedAt    int64  `json:"createdAt"`
	UpdatedAt    int64  `json:"updatedAt"`
}

// Episode represents an episode within a season.
type Episode struct {
	ID            string `json:"id"`
	SeasonID      string `json:"seasonId"`
	MovieID       string `json:"movieId"`
	EpisodeNumber int    `json:"episodeNumber"`
	Title         string `json:"title"`
	Duration      string `json:"duration"`
	CreatedAt     int64  `json:"createdAt"`
	UpdatedAt     int64  `json:"updatedAt"`
}

// StreamLink represents a streaming server URL for a movie or episode.
type StreamLink struct {
	ID         string `json:"id"`
	MovieID    string `json:"movieId,omitempty"`
	EpisodeID  string `json:"episodeId,omitempty"`
	ServerType string `json:"serverType"`
	URL        string `json:"url"`
	Label      string `json:"label"`
	SortOrder  int    `json:"sortOrder"`
	CreatedAt  int64  `json:"createdAt"`
}

// DownloadLink represents a download link for a movie or episode.
type DownloadLink struct {
	ID        string `json:"id"`
	MovieID   string `json:"movieId,omitempty"`
	EpisodeID string `json:"episodeId,omitempty"`
	Quality   string `json:"quality"`
	Size      string `json:"size"`
	URL       string `json:"url"`
	Label     string `json:"label"`
	SortOrder int    `json:"sortOrder"`
	CreatedAt int64  `json:"createdAt"`
}

// EpisodeWithLinks bundles an episode with its stream and download links.
type EpisodeWithLinks struct {
	Episode
	StreamLinks   []StreamLink   `json:"streamLinks"`
	DownloadLinks []DownloadLink `json:"downloadLinks"`
}

// SeasonWithEpisodes bundles a season with its episodes.
type SeasonWithEpisodes struct {
	Season
	Episodes []EpisodeWithLinks `json:"episodes"`
}

// MovieFull represents the comprehensive movie view with all related data.
type MovieFull struct {
	Movie
	Categories    []string             `json:"categories"`
	StreamLinks   []StreamLink         `json:"streamLinks"`
	DownloadLinks []DownloadLink       `json:"downloadLinks"`
	Seasons       []SeasonWithEpisodes `json:"seasons,omitempty"`
}

// MovieFilter represents query criteria for catalog search/browsing.
type MovieFilter struct {
	Query       string
	ContentType string // "movie", "series", or empty
	Category    string // genre
	Industry    string
	Language    string
	Year        int
	IsFeatured  *bool
	IsPrivate   *bool
	IsUpcoming  *bool
	SortBy      string // "newest", "views", "rating", "year"
	Offset      int
	Limit       int
}

// Category represents taxonomy classification.
type Category struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	SortOrder int    `json:"sortOrder"`
	CreatedAt int64  `json:"createdAt"`
}

// Banner represents home carousel/hero banners.
type Banner struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	ImageURL  string `json:"imageUrl"`
	LinkURL   string `json:"linkUrl"`
	MovieID   string `json:"movieId"`
	SortOrder int    `json:"sortOrder"`
	Active    bool   `json:"active"`
	CreatedAt int64  `json:"createdAt"`
	UpdatedAt int64  `json:"updatedAt"`
}

// SocialLink represents public social media links.
type SocialLink struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	URL       string `json:"url"`
	Icon      string `json:"icon"`
	SortOrder int    `json:"sortOrder"`
	CreatedAt int64  `json:"createdAt"`
}

// Notification represents public announcements.
type Notification struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Message   string `json:"message"`
	Link      string `json:"link"`
	CreatedAt int64  `json:"createdAt"`
}

// User represents an app user account.
type User struct {
	UID         string `json:"uid"`
	Email       string `json:"email"`
	Name        string `json:"name"`
	Avatar      string `json:"avatar"`
	Status      string `json:"status"` // "active", "frozen", "deleted"
	CreatedAt   int64  `json:"createdAt"`
	LastSeen    int64  `json:"lastSeen"`
	LastLoginAt int64  `json:"lastLoginAt"`
}

// WatchProgress records where a user paused playback.
type WatchProgress struct {
	UID       string  `json:"uid"`
	MovieID   string  `json:"movieId"`
	EpisodeID string  `json:"episodeId"`
	T         float64 `json:"t"` // timestamp in seconds
	D         float64 `json:"d"` // duration in seconds
	UpdatedAt int64   `json:"updatedAt"`
}

// BrokenLink represents a user link report.
type BrokenLink struct {
	ID          string `json:"id"`
	MovieID     string `json:"movieId"`
	Title       string `json:"title"`
	PosterURL   string `json:"posterUrl"`
	Type        string `json:"type"` // "movie" or "series"
	EpInfo      string `json:"epInfo"`
	ServerType  string `json:"serverType"`
	ReporterUID string `json:"reporterUid"`
	Note        string `json:"note"`
	Status      string `json:"status"` // "open", "fixed", "ignored"
	ReportedAt  int64  `json:"reportedAt"`
}

// ErrorLog represents a client or system error.
type ErrorLog struct {
	ID         string `json:"id"`
	UID        string `json:"uid"`
	Message    string `json:"message"`
	Stack      string `json:"stack"`
	ClientInfo string `json:"clientInfo"`
	CreatedAt  int64  `json:"createdAt"`
}

// SearchStat records search trends.
type SearchStat struct {
	Term           string `json:"term"`
	Count          int    `json:"count"`
	LastSearchedAt int64  `json:"lastSearchedAt"`
}

// WorkerInfo represents a registered replica worker node.
type WorkerInfo struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	KeyHash  string `json:"keyHash"`
	URL      string `json:"url"`
	Created  int64  `json:"created"`
	LastSeen int64  `json:"lastSeen"`
	LastSeq  int64  `json:"lastSeq"`
}

// ChangeItem records a replication change for workers.
type ChangeItem struct {
	Seq   int64  `json:"seq"`
	Tbl   string `json:"tbl"`
	RowID string `json:"rowId"`
	Op    string `json:"op"` // "upsert" or "delete"
	Data  string `json:"data,omitempty"`
	TS    int64  `json:"ts"`
}
