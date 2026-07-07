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
	// 1. Initial schema
	var usersExists bool
	err := db.PG.QueryRow("SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users')").Scan(&usersExists)
	if err != nil {
		return fmt.Errorf("failed to check public tables for users: %w", err)
	}

	if !usersExists {
		slog.Info("Users table not found, running initial migration...")
		if err := db.runMigrationFile("001_initial_schema.sql"); err != nil {
			return err
		}
	} else {
		slog.Info("Users table exists, skipping initial migrations")
	}

	// 2. Devices and Sessions schema
	var devicesExists bool
	err = db.PG.QueryRow("SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'devices')").Scan(&devicesExists)
	if err != nil {
		return fmt.Errorf("failed to check public tables for devices: %w", err)
	}

	if !devicesExists {
		slog.Info("Devices table not found, running devices and sessions migration...")
		if err := db.runMigrationFile("002_devices_and_sessions.sql"); err != nil {
			return err
		}
	} else {
		slog.Info("Devices table exists, skipping devices and sessions migration")
	}

	// 3. Outbox and Consistency schemas
	// We'll use a simple check for the partition_key column to see if 004 was run.
	var partitionKeyExists bool
	err = db.PG.QueryRow("SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'outbox_events' AND column_name = 'partition_key')").Scan(&partitionKeyExists)
	if err != nil {
		return fmt.Errorf("failed to check for partition_key column: %w", err)
	}

	if !partitionKeyExists {
		slog.Info("partition_key not found, running 003 and 004 migrations...")
		if err := db.runMigrationFile("003_session_user_consistency.sql"); err != nil {
			slog.Warn("Failed to run 003 migration (might already be applied)", "error", err)
		}
		if err := db.runMigrationFile("004_outbox_partitioning.sql"); err != nil {
			return err
		}
	} else {
		slog.Info("Outbox partitioning exists, skipping 003 and 004 migrations")
	}

	slog.Info("Database migrations completed successfully")
	return nil
}

func (db *DB) runMigrationFile(filename string) error {
	paths := []string{
		"migrations/" + filename,
		"./migrations/" + filename,
		"apps/api/migrations/" + filename,
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
		return fmt.Errorf("failed to read migration schema file %s: %w", filename, readErr)
	}

	// Execute migrations
	_, err := db.PG.Exec(string(content))
	if err != nil {
		return fmt.Errorf("failed to execute migration script %s: %w", filename, err)
	}

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
