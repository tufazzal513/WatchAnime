package backup

import (
	"bytes"
	"compress/gzip"
	"context"
	"database/sql"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"movex/internal/config"
)

// BackupResult contains summary of completed backup.
type BackupResult struct {
	FilePath     string
	Size         int64
	TelegramSent bool
	Timestamp    time.Time
}

// RunBackup creates a compressed SQLite snapshot, rotates old files,
// and uploads to Telegram if configured.
func RunBackup(cfg *config.Config, db *sql.DB) (*BackupResult, error) {
	backupDir := filepath.Join(cfg.DataDir, "backups")
	if err := os.MkdirAll(backupDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create backup directory: %w", err)
	}

	now := time.Now().UTC()
	ts := now.Format("20060102_150405")
	tempDB := filepath.Join(backupDir, fmt.Sprintf("movex_%s.db", ts))
	targetGZ := filepath.Join(backupDir, fmt.Sprintf("movex_%s.db.gz", ts))

	// 1. Snapshot database using VACUUM INTO or file copy
	if err := snapshotDB(db, cfg.DBPath(), tempDB); err != nil {
		return nil, fmt.Errorf("database snapshot failed: %w", err)
	}
	defer os.Remove(tempDB)

	// 2. Compress to .db.gz
	if err := compressFile(tempDB, targetGZ); err != nil {
		_ = os.Remove(targetGZ)
		return nil, fmt.Errorf("compression failed: %w", err)
	}

	fi, err := os.Stat(targetGZ)
	if err != nil {
		return nil, fmt.Errorf("failed to stat backup archive: %w", err)
	}

	// 3. Rotate old backups
	keep := cfg.TgKeep
	if keep <= 0 {
		keep = 30
	}
	_ = RotateBackups(backupDir, keep)

	res := &BackupResult{
		FilePath:  targetGZ,
		Size:      fi.Size(),
		Timestamp: now,
	}

	// 4. Send to Telegram if configured
	if cfg.TelegramConfigured() {
		caption := fmt.Sprintf(
			"📦 MoveX Automated Database Backup\n📅 Date: %s UTC\n💾 Size: %.2f KB\n📁 File: %s",
			now.Format("2006-01-02 15:04:05"),
			float64(fi.Size())/1024.0,
			filepath.Base(targetGZ),
		)
		if err := SendToTelegram(cfg.BotToken(), cfg.TgChatID, targetGZ, caption); err != nil {
			slog.Warn("failed to send backup to Telegram", "err", err)
		} else {
			res.TelegramSent = true
			slog.Info("backup archive dispatched to Telegram channel", "chat_id", cfg.TgChatID, "file", filepath.Base(targetGZ))
		}
	}

	slog.Info("database backup created successfully", "path", targetGZ, "size_bytes", fi.Size())
	return res, nil
}

// snapshotDB takes a consistent SQLite database copy.
func snapshotDB(db *sql.DB, sourcePath, destPath string) error {
	// Try VACUUM INTO
	_, err := db.Exec(fmt.Sprintf("VACUUM INTO '%s'", strings.ReplaceAll(destPath, "'", "''")))
	if err == nil {
		return nil
	}

	// Fallback: WAL checkpoint truncate and safe file copy
	_, _ = db.Exec("PRAGMA wal_checkpoint(TRUNCATE)")

	src, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer src.Close()

	dst, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return err
	}
	return dst.Sync()
}

// compressFile reads src, compresses with gzip, and writes to dst.
func compressFile(srcPath, dstPath string) error {
	src, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer src.Close()

	dst, err := os.Create(dstPath)
	if err != nil {
		return err
	}
	defer dst.Close()

	gw, err := gzip.NewWriterLevel(dst, gzip.BestCompression)
	if err != nil {
		return err
	}
	defer gw.Close()

	if _, err := io.Copy(gw, src); err != nil {
		return err
	}
	return gw.Close()
}

// RotateBackups removes oldest .db.gz files exceeding keepCount.
func RotateBackups(dir string, keepCount int) error {
	if keepCount <= 0 {
		keepCount = 30
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}

	type fileInfo struct {
		name    string
		modTime time.Time
	}

	var backups []fileInfo
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".db.gz") {
			info, err := e.Info()
			if err == nil {
				backups = append(backups, fileInfo{
					name:    filepath.Join(dir, e.Name()),
					modTime: info.ModTime(),
				})
			}
		}
	}

	if len(backups) <= keepCount {
		return nil
	}

	// Sort newest first
	sort.Slice(backups, func(i, j int) bool {
		return backups[i].modTime.After(backups[j].modTime)
	})

	// Delete from keepCount to end
	for i := keepCount; i < len(backups); i++ {
		_ = os.Remove(backups[i].name)
		slog.Info("rotated old backup archive", "file", backups[i].name)
	}

	return nil
}

// SendToTelegram posts the backup file as a document to the given Telegram chat.
func SendToTelegram(botToken, chatID, filePath, caption string) error {
	return sendToTelegramWithURL(fmt.Sprintf("https://api.telegram.org/bot%s/sendDocument", botToken), chatID, filePath, caption)
}

func sendToTelegramWithURL(apiURL, chatID, filePath, caption string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("open file error: %w", err)
	}
	defer file.Close()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// chat_id
	if err := writer.WriteField("chat_id", chatID); err != nil {
		return err
	}

	// caption
	if caption != "" {
		if err := writer.WriteField("caption", caption); err != nil {
			return err
		}
	}

	// document file
	part, err := writer.CreateFormFile("document", filepath.Base(filePath))
	if err != nil {
		return err
	}
	if _, err := io.Copy(part, file); err != nil {
		return err
	}

	if err := writer.Close(); err != nil {
		return err
	}

	req, err := http.NewRequest("POST", apiURL, body)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("telegram request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("telegram api error HTTP %d: %s", resp.StatusCode, string(respBytes))
	}

	return nil
}

// Restore restores a SQLite database from a given backup file (.db or .db.gz).
func Restore(dbPath, backupFilePath string) error {
	backupData, err := os.ReadFile(backupFilePath)
	if err != nil {
		return fmt.Errorf("failed to read backup file: %w", err)
	}

	var rawDB []byte
	if strings.HasSuffix(backupFilePath, ".gz") {
		gr, err := gzip.NewReader(bytes.NewReader(backupData))
		if err != nil {
			return fmt.Errorf("invalid gzip archive: %w", err)
		}
		defer gr.Close()

		rawDB, err = io.ReadAll(gr)
		if err != nil {
			return fmt.Errorf("decompression error: %w", err)
		}
	} else {
		rawDB = backupData
	}

	// Validate SQLite format 3 magic header (16 bytes)
	magicHeader := "SQLite format 3\x00"
	if len(rawDB) < len(magicHeader) || string(rawDB[:len(magicHeader)]) != magicHeader {
		return fmt.Errorf("invalid SQLite database header")
	}

	// Safe write: write to temp file first, then atomically rename
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	tmpFile := dbPath + ".restore_tmp"
	if err := os.WriteFile(tmpFile, rawDB, 0644); err != nil {
		return fmt.Errorf("failed to write restore temp file: %w", err)
	}

	// Backup existing database if present
	if _, err := os.Stat(dbPath); err == nil {
		_ = os.Rename(dbPath, dbPath+".bak")
	}

	// Clean any old WAL/SHM files
	_ = os.Remove(dbPath + "-wal")
	_ = os.Remove(dbPath + "-shm")

	if err := os.Rename(tmpFile, dbPath); err != nil {
		return fmt.Errorf("failed to replace database file: %w", err)
	}

	slog.Info("database restored successfully", "path", dbPath, "source", backupFilePath)
	return nil
}

// StartScheduler launches the periodic background backup runner.
func StartScheduler(ctx context.Context, cfg *config.Config, db *sql.DB) {
	if cfg.BackupEveryHours <= 0 {
		return
	}

	interval := time.Duration(cfg.BackupEveryHours) * time.Hour
	slog.Info("backup scheduler started", "interval", interval.String())

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				slog.Info("backup scheduler stopped")
				return
			case <-ticker.C:
				slog.Info("triggering scheduled database backup")
				if _, err := RunBackup(cfg, db); err != nil {
					slog.Error("scheduled backup failed", "err", err)
				}
			}
		}
	}()
}
