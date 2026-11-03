package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"movex/internal/admin"
	"movex/internal/api"
	"movex/internal/auth"
	"movex/internal/backup"
	"movex/internal/config"
	"movex/internal/db"
	"movex/internal/presence"
	"movex/internal/repo"
	"movex/internal/sync"
)

var (
	Version   = "1.0.0"
	BuildDate = "2026-11-02"
)

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "version", "-v", "--version":
			fmt.Printf("MoveX Backend %s (built %s)\n", Version, BuildDate)
			return
		case "serve":
			// default command continues below
		case "backup":
			if err := runBackupCmd(); err != nil {
				slog.Error("backup command failed", "err", err)
				os.Exit(1)
			}
			return
		case "restore":
			if len(os.Args) < 3 {
				fmt.Fprintln(os.Stderr, "Usage: movex restore <backup_file_path>")
				os.Exit(1)
			}
			if err := runRestoreCmd(os.Args[2]); err != nil {
				slog.Error("restore command failed", "err", err)
				os.Exit(1)
			}
			return
		case "help", "-h", "--help":
			printUsage()
			return
		default:
			fmt.Fprintf(os.Stderr, "unknown command: %s\n\n", os.Args[1])
			printUsage()
			os.Exit(1)
		}
	}

	if err := runServer(); err != nil {
		slog.Error("server exited with error", "err", err)
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("Usage: movex [command]")
	fmt.Println()
	fmt.Println("Commands:")
	fmt.Println("  serve                Start the MoveX backend server (default)")
	fmt.Println("  backup               Trigger immediate database snapshot & Telegram dispatch")
	fmt.Println("  restore <backup_file> Restore SQLite database from specified archive (.db or .db.gz)")
	fmt.Println("  version              Print version and exit")
	fmt.Println("  help                 Show this help message")
}

func runBackupCmd() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("configuration error: %w", err)
	}
	database, err := db.Open(cfg.DBPath())
	if err != nil {
		return fmt.Errorf("database open error: %w", err)
	}
	defer database.Close()

	res, err := backup.RunBackup(cfg, database)
	if err != nil {
		return err
	}
	fmt.Printf("Database backup completed successfully:\n  File: %s\n  Size: %d bytes\n  Telegram Sent: %v\n",
		res.FilePath, res.Size, res.TelegramSent)
	return nil
}

func runRestoreCmd(backupPath string) error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("configuration error: %w", err)
	}
	if err := backup.Restore(cfg.DBPath(), backupPath); err != nil {
		return err
	}
	fmt.Printf("Database successfully restored from %s to %s\n", backupPath, cfg.DBPath())
	return nil
}

func runServer() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("configuration error: %w", err)
	}

	// Structured logger setup
	logLevel := slog.LevelInfo
	if cfg.DevInsecureAuth {
		logLevel = slog.LevelDebug
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: logLevel,
	}))
	slog.SetDefault(logger)

	slog.Info("starting MoveX backend",
		"version", Version,
		"role", cfg.Role,
		"port", cfg.Port,
		"data_dir", cfg.DataDir,
		"cookie_secure", cfg.CookieSecure,
	)

	// Open SQLite database and run embedded migrations
	database, err := db.Open(cfg.DBPath())
	if err != nil {
		return fmt.Errorf("failed to open database at %q: %w", cfg.DBPath(), err)
	}
	defer database.Close()
	slog.Info("database initialized and migrations applied", "path", cfg.DBPath())

	movieRepo := repo.NewMovieRepo(database)
	catalogRepo := repo.NewCatalogRepo(database)
	userRepo := repo.NewUserRepo(database)
	presenceTracker := presence.NewTracker()

	verifier := auth.NewTokenVerifier(cfg.FirebaseProjectID, cfg.DevInsecureAuth)
	userAPI := api.NewUserAPIHandler(cfg, movieRepo, catalogRepo, userRepo, presenceTracker)

	serverHandler := api.NewServerHandler(cfg, Version, func() []api.ServerInfo {
		workers, err := userRepo.ListWorkers()
		if err != nil {
			return nil
		}
		var list []api.ServerInfo
		for _, w := range workers {
			list = append(list, api.ServerInfo{
				Name:     w.Name,
				URL:      w.URL,
				LastSeen: w.LastSeen,
			})
		}
		return list
	})

	mux := http.NewServeMux()
	api.RegisterUserAPIRoutes(mux, cfg, userAPI, serverHandler, verifier, userRepo)

	// Admin SSR panel (available on main role)
	if cfg.Role == "main" {
		adminMgr := auth.NewAdminManager(cfg)
		adminHandler, err := admin.NewAdminHandler(cfg, adminMgr, movieRepo, catalogRepo, userRepo, presenceTracker)
		if err != nil {
			return fmt.Errorf("failed to initialize admin handler: %w", err)
		}
		adminHandler.SetDB(database)
		admin.RegisterAdminRoutes(mux, adminHandler, adminMgr)
		slog.Info("admin SSR panel registered", "path", "/admin/")
	}

	// Static frontend file serving for standalone deployment
	frontendDir := "frontend"
	if _, err := os.Stat(frontendDir); err != nil {
		if _, err := os.Stat("../frontend"); err == nil {
			frontendDir = "../frontend"
		}
	}
	if fi, err := os.Stat(frontendDir); err == nil && fi.IsDir() {
		fileServer := http.FileServer(http.Dir(frontendDir))
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/api/") || strings.HasPrefix(r.URL.Path, "/admin/") {
				http.NotFound(w, r)
				return
			}
			target := filepath.Join(frontendDir, filepath.Clean(r.URL.Path))
			if info, err := os.Stat(target); err == nil && !info.IsDir() {
				fileServer.ServeHTTP(w, r)
				return
			}
			http.ServeFile(w, r, filepath.Join(frontendDir, "index.html"))
		})
		slog.Info("static frontend file serving enabled", "dir", frontendDir)
	}

	// Apply middleware pipeline (Logging -> Security Headers -> CORS -> Gzip/ETag -> Router)
	var handler http.Handler = mux
	handler = api.GzipAndETagMiddleware(handler)
	handler = api.CORSMiddleware(cfg)(handler)
	handler = api.SecurityHeadersMiddleware(cfg)(handler)
	handler = api.LoggingAndRecoveryMiddleware(handler)

	addr := fmt.Sprintf("0.0.0.0:%d", cfg.Port)
	srv := &http.Server{
		Addr:         addr,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Background lifecycle context for schedulers & daemons
	bgCtx, bgCancel := context.WithCancel(context.Background())
	defer bgCancel()

	// Launch background engine routines based on server role
	if cfg.Role == "main" {
		backup.StartScheduler(bgCtx, cfg, database)
	} else if cfg.Role == "worker" {
		sync.StartWorkerDaemon(bgCtx, cfg, database, userRepo)
	}

	// Server shutdown channel
	shutdownChan := make(chan os.Signal, 1)
	signal.Notify(shutdownChan, os.Interrupt, syscall.SIGTERM)

	serverErrChan := make(chan error, 1)
	go func() {
		slog.Info("HTTP server listening", "addr", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			serverErrChan <- err
		}
	}()

	select {
	case err := <-serverErrChan:
		return fmt.Errorf("server error: %w", err)
	case sig := <-shutdownChan:
		slog.Info("received shutdown signal, shutting down gracefully", "signal", sig.String())
		bgCancel() // stop background backup/sync tasks
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := srv.Shutdown(ctx); err != nil {
			return fmt.Errorf("graceful shutdown failed: %w", err)
		}
		slog.Info("MoveX backend stopped cleanly")
	}

	return nil
}
