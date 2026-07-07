package main

import (
	"context"
	"database/sql"
	"log"
	"log/slog"
	"net/http"
	"os"

	_ "github.com/joho/godotenv/autoload"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
	"github.com/synapse/gateway/internal/config"
	"github.com/synapse/gateway/internal/pubsub"
	"github.com/synapse/gateway/internal/websocket"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg := config.Load()

	// Redis client
	rdb := redis.NewClient(&redis.Options{
		Addr: cfg.RedisAddress(),
	})
	ctx := context.Background()
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("gateway: failed to connect to Redis: %v", err)
	}
	slog.Info("gateway: connected to Redis", "addr", cfg.RedisAddress())

	// Postgres client
	db, err := sql.Open("postgres", cfg.PostgresDSN())
	if err != nil {
		log.Fatalf("gateway: failed to open postgres connection: %v", err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		log.Fatalf("gateway: failed to ping postgres: %v", err)
	}
	slog.Info("gateway: connected to Postgres")

	// Hub — manages connections + guild-level broadcast
	hub := websocket.NewHub(db)
	go hub.Run()

	// Redis pub/sub subscriber — bridges API events to WS clients
	sub := pubsub.New(rdb, hub)
	go sub.Run(ctx)

	// HTTP routes
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		websocket.ServeWS(hub, db, rdb, cfg.SessionCookieName, w, r)
	})
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	slog.Info("gateway: WebSocket server starting", "port", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, mux); err != nil {
		log.Fatalf("gateway: server failed: %v", err)
	}
}
