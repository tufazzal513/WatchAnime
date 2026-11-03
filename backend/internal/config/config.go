package config

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// Config represents all application configuration loaded from environment variables.
type Config struct {
	Role             string   // "main" or "worker"
	Port             int      // default 3000
	DataDir          string   // default "./data"
	FirebaseProjectID string  // token aud/iss check
	FirebaseAPIKey   string   // Firebase REST calls
	AdminUIDs        []string // comma-separated UIDs
	AllowedOrigins   []string // comma-separated CORS origins
	TrustProxy       bool     // trust X-Forwarded-For
	CookieSecure     bool     // default true
	SessionSecret    []byte   // HMAC secret for admin cookies
	BackupEveryHours int      // default 12
	TgBotToken       string   // Telegram bot API token
	TgAPIID          int      // Telegram MTProto api_id
	TgAPIHash        string   // Telegram MTProto api_hash
	TgChatID         string   // Telegram channel ID
	TgKeep           int      // default 30 backups kept
	MainURL          string   // worker only: URL of main server
	WorkerKey        string   // worker only: shared worker authentication key
	PublicURL        string   // worker only: public accessible URL for server discovery
	SyncEverySec     int      // worker only: default 60
	DevInsecureAuth  bool     // test only: accepts "dev:<uid>" tokens
	AdminUsername    string   // admin login username (default: "admin")
	AdminPassword    string   // admin login password (default: "admin123")
}

// TelegramConfigured checks if Telegram credentials are provided.
func (c *Config) TelegramConfigured() bool {
	hasToken := c.TgBotToken != "" || (strings.Contains(c.TgAPIHash, ":") && len(c.TgAPIHash) > 10)
	return hasToken && c.TgChatID != ""
}

// BotToken returns the active bot token if configured.
func (c *Config) BotToken() string {
	if c.TgBotToken != "" {
		return c.TgBotToken
	}
	if strings.Contains(c.TgAPIHash, ":") {
		return c.TgAPIHash
	}
	return ""
}

// Load loads and validates configuration from environment variables.
func Load() (*Config, error) {
	cfg := &Config{
		Role:             getEnv("ROLE", "main"),
		Port:             getPort(),
		DataDir:          getEnv("DATA_DIR", "./data"),
		FirebaseProjectID: os.Getenv("FIREBASE_PROJECT_ID"),
		FirebaseAPIKey:   os.Getenv("FIREBASE_API_KEY"),
		TrustProxy:       getEnvBool("TRUST_PROXY", false),
		CookieSecure:     getEnvBool("COOKIE_SECURE", true),
		BackupEveryHours: getEnvInt("BACKUP_EVERY_HOURS", 12),
		TgBotToken:       os.Getenv("TG_BOT_TOKEN"),
		TgAPIID:          getEnvInt("TG_API_ID", 0),
		TgAPIHash:        os.Getenv("TG_API_HASH"),
		TgChatID:         os.Getenv("TG_CHAT_ID"),
		TgKeep:           getEnvInt("TG_KEEP", 30),
		MainURL:          strings.TrimRight(os.Getenv("MAIN_URL"), "/"),
		WorkerKey:        os.Getenv("WORKER_KEY"),
		PublicURL:        strings.TrimRight(os.Getenv("PUBLIC_URL"), "/"),
		SyncEverySec:     getEnvInt("SYNC_EVERY_SEC", 60),
		DevInsecureAuth:  getEnvBool("DEV_INSECURE_AUTH", false),
		AdminUsername:    getEnv("ADMIN_USERNAME", "admin"),
		AdminPassword:    getEnv("ADMIN_PASSWORD", "admin123"),
	}

	// Parse AdminUIDs
	if uids := os.Getenv("ADMIN_UIDS"); uids != "" {
		for _, u := range strings.Split(uids, ",") {
			trimmed := strings.TrimSpace(u)
			if trimmed != "" {
				cfg.AdminUIDs = append(cfg.AdminUIDs, trimmed)
			}
		}
	}

	// Parse AllowedOrigins
	if origins := os.Getenv("ALLOWED_ORIGINS"); origins != "" {
		for _, o := range strings.Split(origins, ",") {
			trimmed := strings.TrimSpace(o)
			if trimmed != "" {
				cfg.AllowedOrigins = append(cfg.AllowedOrigins, trimmed)
			}
		}
	} else {
		cfg.AllowedOrigins = []string{"*"}
	}

	// Validation
	if cfg.Role != "main" && cfg.Role != "worker" {
		return nil, fmt.Errorf("invalid ROLE %q: must be 'main' or 'worker'", cfg.Role)
	}

	if cfg.Role == "worker" {
		if cfg.MainURL == "" {
			return nil, fmt.Errorf("MAIN_URL is required when ROLE is 'worker'")
		}
		if cfg.WorkerKey == "" {
			return nil, fmt.Errorf("WORKER_KEY is required when ROLE is 'worker'")
		}
	}

	// Session Secret setup
	secretStr := os.Getenv("SESSION_SECRET")
	if secretStr != "" {
		cfg.SessionSecret = []byte(secretStr)
	} else {
		// Resolve or generate in DATA_DIR
		if err := os.MkdirAll(cfg.DataDir, 0700); err != nil {
			return nil, fmt.Errorf("failed to create DATA_DIR %q: %w", cfg.DataDir, err)
		}
		secretFile := filepath.Join(cfg.DataDir, "session.key")
		data, err := os.ReadFile(secretFile)
		if err == nil && len(data) >= 32 {
			cfg.SessionSecret = data
		} else {
			randSecret := make([]byte, 32)
			if _, err := rand.Read(randSecret); err != nil {
				return nil, fmt.Errorf("failed to generate random session secret: %w", err)
			}
			cfg.SessionSecret = []byte(hex.EncodeToString(randSecret))
			_ = os.WriteFile(secretFile, cfg.SessionSecret, 0600)
		}
	}

	return cfg, nil
}

// IsAdmin checks if a given UID is registered as an admin.
func (c *Config) IsAdmin(uid string) bool {
	if uid == "" || c.Role != "main" {
		return false
	}
	if uid == "admin_root" {
		return true
	}
	if len(c.AdminUIDs) == 0 {
		return true
	}
	for _, adminUID := range c.AdminUIDs {
		if adminUID == uid {
			return true
		}
	}
	return false
}

// DBPath returns the SQLite database file path.
func (c *Config) DBPath() string {
	return filepath.Join(c.DataDir, "movex.db")
}

func getPort() int {
	if val := os.Getenv("PORT"); val != "" {
		if n, err := strconv.Atoi(val); err == nil && n > 0 {
			return n
		}
	}
	if val := os.Getenv("SERVER_PORT"); val != "" {
		if n, err := strconv.Atoi(val); err == nil && n > 0 {
			return n
		}
	}
	return 3000
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if val := os.Getenv(key); val != "" {
		if n, err := strconv.Atoi(val); err == nil {
			return n
		}
	}
	return defaultVal
}

func getEnvBool(key string, defaultVal bool) bool {
	if val := os.Getenv(key); val != "" {
		val = strings.ToLower(strings.TrimSpace(val))
		return val == "1" || val == "true" || val == "yes"
	}
	return defaultVal
}
