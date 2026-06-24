package database

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"time"

	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
	"github.com/synapse/api/internal/config"
)

type DB struct {
	PG    *sql.DB
	Redis *redis.Client
}

func Connect(cfg *config.Config) (*DB, error) {
	// 1. Connect to Postgres
	pg, err := sql.Open("postgres", cfg.PostgresDSN())
	if err != nil {
		return nil, fmt.Errorf("failed to open postgres connection: %w", err)
	}

	pg.SetMaxOpenConns(25)
	pg.SetMaxIdleConns(25)
	pg.SetConnMaxLifetime(5 * time.Minute)

	// Ping database with retry
	var pingErr error
	for i := range 5 {
		if pingErr = pg.Ping(); pingErr == nil {
			break
		}
		slog.Warn("Failed to ping postgres, retrying...", "attempt", i+1, "error", pingErr)
		time.Sleep(1 * time.Second)
	}
	if pingErr != nil {
		return nil, fmt.Errorf("failed to ping postgres: %w", pingErr)
	}

	// 2. Connect to Redis
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddress(),
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		slog.Warn("Failed to ping redis, caching operations might be degraded", "error", err)
	}

	db := &DB{
		PG:    pg,
		Redis: rdb,
	}

	// 3. Run migrations on startup
	if err := db.runMigrations(); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return db, nil
}

func (db *DB) runMigrations() error {
	// Check if tables already exist
	var exists bool
	err := db.PG.QueryRow("SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users')").Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check public tables: %w", err)
	}

	if exists {
		slog.Info("Schema already exists, skipping initial migrations")
		return nil
	}

	slog.Info("Users table not found, running initial migration...")

	// Try multiple paths to read the sql file
	paths := []string{
		"migrations/001_initial_schema.sql",
		"./migrations/001_initial_schema.sql",
		"apps/api/migrations/001_initial_schema.sql",
	}

	var content []byte
	var readErr error
	for _, p := range paths {
		content, readErr = os.ReadFile(p)
		if readErr == nil {
			slog.Info("Found migration file", "path", p)
			break
		}
	}

	if readErr != nil {
		return fmt.Errorf("failed to read migration schema file: %w", readErr)
	}

	// Execute migrations
	_, err = db.PG.Exec(string(content))
	if err != nil {
		return fmt.Errorf("failed to execute migration script: %w", err)
	}

	slog.Info("Initial database migration completed successfully")
	return nil
}

func (db *DB) Close() {
	if db.PG != nil {
		db.PG.Close()
	}
	if db.Redis != nil {
		db.Redis.Close()
	}
}