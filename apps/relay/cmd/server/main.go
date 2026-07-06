package main

import (
	"context"
	"database/sql"
	"log/slog"
	"os"
	"os/signal"
	"sync"
	"syscall"

	_ "github.com/joho/godotenv/autoload"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
	"github.com/synapse/relay/internal/config"
	"github.com/synapse/relay/internal/worker"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	slog.Info("Starting Synapse Outbox Relay...")

	cfg, err := config.LoadConfig()
	if err != nil {
		slog.Error("Failed to load config", "err", err)
		os.Exit(1)
	}

	// Connect to Postgres
	connStr := "host=" + cfg.DBHost + " port=" + cfg.DBPort + " user=" + cfg.DBUser + " password=" + cfg.DBPassword + " dbname=" + cfg.DBName + " sslmode=disable"
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		slog.Error("Failed to connect to postgres", "err", err)
		os.Exit(1)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		slog.Error("Failed to ping postgres", "err", err)
		os.Exit(1)
	}

	// Connect to Redis
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})
	defer rdb.Close()
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		slog.Error("Failed to connect to redis", "err", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithCancel(context.Background())

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigChan
		slog.Info("Shutting down workers...")
		cancel()
	}()

	var wg sync.WaitGroup

	// If WORKER_PARTITION is explicitly set in env (e.g. >= 0), run only that partition.
	// Otherwise (if it defaults to 0 and we want to run all), we'll run all partitions in this process.
	// Let's check if the env var was set.
	partStr := os.Getenv("WORKER_PARTITION")
	if partStr != "" {
		slog.Info("Running single partition worker", "partition", cfg.WorkerPartition)
		w := worker.NewWorker(db, rdb, cfg)
		wg.Add(1)
		go func() {
			defer wg.Done()
			w.Start(ctx)
		}()
	} else {
		slog.Info("Running all partition workers in single process", "count", cfg.WorkerCount)
		for i := 0; i < cfg.WorkerCount; i++ {
			partitionCfg := *cfg
			partitionCfg.WorkerPartition = int16(i)
			w := worker.NewWorker(db, rdb, &partitionCfg)
			wg.Add(1)
			go func(w *worker.Worker) {
				defer wg.Done()
				w.Start(ctx)
			}(w)
		}
	}

	wg.Wait()
	slog.Info("Relay shutdown complete")
}
