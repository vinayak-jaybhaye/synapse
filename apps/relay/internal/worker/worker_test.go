package worker

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/go-redis/redismock/v9"
)

func TestWorker_processBatch_Success(t *testing.T) {
	db, mockDB, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to open sqlmock: %v", err)
	}
	defer db.Close()

	rdb, mockRedis := redismock.NewClientMock()

	worker := &Worker{
		db:        db,
		rdb:       rdb,
		partition: 0,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	payloadBytes := []byte(`{"content":"hello"}`)
	event := OutboxEvent{
		ID:            123,
		AggregateType: "channel",
		AggregateID:   456,
		EventType:     "MESSAGE_CREATED",
		Payload:       payloadBytes,
		RetryCount:    0,
	}

	// 1. Begin Tx
	mockDB.ExpectBegin()

	// 2. Select FOR UPDATE
	rows := sqlmock.NewRows([]string{"id", "aggregate_type", "aggregate_id", "event_type", "payload", "retry_count"}).
		AddRow(event.ID, event.AggregateType, event.AggregateID, event.EventType, event.Payload, event.RetryCount)
	mockDB.ExpectQuery(`SELECT id, aggregate_type, aggregate_id, event_type, payload, retry_count`).
		WithArgs(int16(0)).
		WillReturnRows(rows)

	// 3. Publish to Redis Pub/Sub
	type pubsubEnvelope struct {
		Op string          `json:"op"`
		T  string          `json:"t"`
		D  json.RawMessage `json:"d"`
	}
	expectedEnvelope := pubsubEnvelope{
		Op: "DISPATCH",
		T:  event.EventType,
		D:  json.RawMessage(event.Payload),
	}
	expectedJSON, _ := json.Marshal(expectedEnvelope)

	mockRedis.ExpectPublish("channel:456", string(expectedJSON)).SetVal(1)

	// 4. Update status = 1 (Processed)
	mockDB.ExpectExec(`UPDATE outbox_events SET status = 1, processed_at = NOW\(\) WHERE id = \$1`).
		WithArgs(event.ID).
		WillReturnResult(sqlmock.NewResult(1, 1))

	// 5. Commit
	mockDB.ExpectCommit()

	// Run processBatch
	worker.processBatch(ctx)

	if err := mockDB.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled db expectations: %s", err)
	}
	if err := mockRedis.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled redis expectations: %s", err)
	}
}

func TestWorker_processBatch_PublishFailure(t *testing.T) {
	db, mockDB, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to open sqlmock: %v", err)
	}
	defer db.Close()

	rdb, mockRedis := redismock.NewClientMock()

	worker := &Worker{
		db:        db,
		rdb:       rdb,
		partition: 0,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	payloadBytes := []byte(`{"content":"hello"}`)
	event := OutboxEvent{
		ID:            123,
		AggregateType: "guild",
		AggregateID:   789,
		EventType:     "GUILD_UPDATED",
		Payload:       payloadBytes,
		RetryCount:    0,
	}

	// 1. Begin Tx
	mockDB.ExpectBegin()

	// 2. Select FOR UPDATE
	rows := sqlmock.NewRows([]string{"id", "aggregate_type", "aggregate_id", "event_type", "payload", "retry_count"}).
		AddRow(event.ID, event.AggregateType, event.AggregateID, event.EventType, event.Payload, event.RetryCount)
	mockDB.ExpectQuery(`SELECT id, aggregate_type, aggregate_id, event_type, payload, retry_count`).
		WithArgs(int16(0)).
		WillReturnRows(rows)

	// 3. Publish to Redis Pub/Sub (FAILS)
	type pubsubEnvelope struct {
		Op string          `json:"op"`
		T  string          `json:"t"`
		D  json.RawMessage `json:"d"`
	}
	expectedEnvelope := pubsubEnvelope{
		Op: "DISPATCH",
		T:  event.EventType,
		D:  json.RawMessage(event.Payload),
	}
	expectedJSON, _ := json.Marshal(expectedEnvelope)

	mockRedis.ExpectPublish("guild:789", string(expectedJSON)).SetErr(context.DeadlineExceeded)

	// 4. Update status = 0 (Leave pending, increment retry)
	mockDB.ExpectExec(`UPDATE outbox_events SET retry_count = \$1, status = \$2 WHERE id = \$3`).
		WithArgs(1, 0, event.ID). // retry=1, status=0
		WillReturnResult(sqlmock.NewResult(1, 1))

	// 5. Commit
	mockDB.ExpectCommit()

	// Run processBatch
	worker.processBatch(ctx)

	if err := mockDB.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled db expectations: %s", err)
	}
	if err := mockRedis.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled redis expectations: %s", err)
	}
}
