package worker

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"github.com/lib/pq"
	"github.com/redis/go-redis/v9"
	"github.com/synapse/relay/internal/config"
)

type OutboxEvent struct {
	ID            int64
	AggregateType string
	AggregateID   int64
	EventType     string
	Payload       []byte
	RetryCount    int
}

type Worker struct {
	db        *sql.DB
	rdb       *redis.Client
	partition int16
	listener  *pq.Listener
}

func NewWorker(db *sql.DB, rdb *redis.Client, cfg *config.Config) *Worker {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName)

	reportProblem := func(ev pq.ListenerEventType, err error) {
		if err != nil {
			slog.Error("pq listener error", "err", err)
		}
	}

	listener := pq.NewListener(connStr, 10*time.Second, time.Minute, reportProblem)

	return &Worker{
		db:        db,
		rdb:       rdb,
		partition: cfg.WorkerPartition,
		listener:  listener,
	}
}

func (w *Worker) Start(ctx context.Context) {
	err := w.listener.Listen("outbox_new")
	if err != nil {
		slog.Error("failed to listen on outbox_new", "err", err)
		return
	}
	slog.Info("Worker started", "partition", w.partition)

	// Fallback ticker
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	defer w.listener.Close()

	for {
		// Process immediately on start
		w.processBatch(ctx)

		select {
		case <-ctx.Done():
			slog.Info("Worker shutting down")
			return
		case <-ticker.C:
			// Fallback poll
			w.processBatch(ctx)
		case n := <-w.listener.Notify:
			if n == nil {
				continue
			}
			// Check if the notification is for our partition
			if n.Extra == strconv.Itoa(int(w.partition)) {
				w.processBatch(ctx)
			}
		}
	}
}

func (w *Worker) processBatch(ctx context.Context) {
	tx, err := w.db.BeginTx(ctx, nil)
	if err != nil {
		slog.Error("failed to begin tx", "err", err)
		return
	}
	defer tx.Rollback()

	query := `
		SELECT id, aggregate_type, aggregate_id, event_type, payload, retry_count
		FROM outbox_events
		WHERE status = 0 AND partition_key = $1
		ORDER BY id ASC
		LIMIT 100
		FOR UPDATE SKIP LOCKED
	`

	rows, err := tx.QueryContext(ctx, query, w.partition)
	if err != nil {
		slog.Error("failed to query outbox_events", "err", err)
		return
	}
	defer rows.Close()

	var events []OutboxEvent
	for rows.Next() {
		var e OutboxEvent
		if err := rows.Scan(&e.ID, &e.AggregateType, &e.AggregateID, &e.EventType, &e.Payload, &e.RetryCount); err != nil {
			slog.Error("failed to scan outbox event", "err", err)
			continue
		}
		events = append(events, e)
	}
	rows.Close()

	if len(events) == 0 {
		return
	}

	for _, e := range events {
		success := w.publishEvent(ctx, e)

		if success {
			// Mark processed
			updateQuery := `UPDATE outbox_events SET status = 1, processed_at = NOW() WHERE id = $1`
			_, err = tx.ExecContext(ctx, updateQuery, e.ID)
			if err != nil {
				slog.Error("failed to mark event processed", "err", err, "id", e.ID)
			}
		} else {
			// Handle dead-letter / retry
			newRetry := e.RetryCount + 1
			newStatus := 0
			if newRetry >= 10 {
				newStatus = 2 // Dead-letter
				slog.Warn("Event reached max retries, dead-lettering", "id", e.ID)
			}
			updateQuery := `UPDATE outbox_events SET retry_count = $1, status = $2 WHERE id = $3`
			_, err = tx.ExecContext(ctx, updateQuery, newRetry, newStatus, e.ID)
			if err != nil {
				slog.Error("failed to update event retry count", "err", err, "id", e.ID)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		slog.Error("failed to commit batch tx", "err", err)
	}
}

func (w *Worker) publishEvent(ctx context.Context, e OutboxEvent) bool {
	streamName := fmt.Sprintf("%s:%d", e.AggregateType, e.AggregateID)

	type pubsubEnvelope struct {
		Op string          `json:"op"`
		T  string          `json:"t"`
		D  json.RawMessage `json:"d"`
	}

	envelope := pubsubEnvelope{
		Op: "DISPATCH",
		T:  e.EventType,
		D:  json.RawMessage(e.Payload),
	}

	b, err := json.Marshal(envelope)
	if err != nil {
		slog.Error("failed to marshal pubsub envelope", "err", err, "id", e.ID)
		return false
	}

	err = w.rdb.Publish(ctx, streamName, string(b)).Err()

	if err != nil {
		slog.Error("failed to publish to redis pub/sub", "err", err, "stream", streamName)
		return false
	}
	return true
}
