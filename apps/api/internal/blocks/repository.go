package blocks

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/synapse/api/internal/snowflake"
)

type Repository interface {
	BlockUser(ctx context.Context, blockerID, blockedID int64, event *OutboxEvent) error
	UnblockUser(ctx context.Context, blockerID, blockedID int64, event *OutboxEvent) error
	IsBlocked(ctx context.Context, blockerID, blockedID int64) (bool, error)
	CheckMutualBlock(ctx context.Context, userA, userB int64) (bool, error)
	GetBlockedUsers(ctx context.Context, blockerID int64) ([]int64, error)
}

type pgRepository struct {
	db *sql.DB
}

func NewPGRepository(db *sql.DB) Repository {
	return &pgRepository{db: db}
}

func (r *pgRepository) BlockUser(ctx context.Context, blockerID, blockedID int64, event *OutboxEvent) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin tx: %w", err)
	}
	defer tx.Rollback()

	query := `
		INSERT INTO user_blocks (blocker_id, blocked_id) 
		VALUES ($1, $2) 
		ON CONFLICT DO NOTHING
	`
	_, err = tx.ExecContext(ctx, query, blockerID, blockedID)
	if err != nil {
		return fmt.Errorf("failed to insert user block: %w", err)
	}

	if event != nil {
		insertOutbox := `
			INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status, partition_key) 
			VALUES ($1, $2, $3, $4, $5, 0, $6)
		`
		_, err = tx.ExecContext(ctx, insertOutbox, snowflake.GenerateID(), event.AggregateType, event.AggregateID, event.EventType, event.Payload, event.PartitionKey)
		if err != nil {
			return fmt.Errorf("failed to insert outbox event: %w", err)
		}
	}

	return tx.Commit()
}

func (r *pgRepository) UnblockUser(ctx context.Context, blockerID, blockedID int64, event *OutboxEvent) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin tx: %w", err)
	}
	defer tx.Rollback()

	query := `DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`
	_, err = tx.ExecContext(ctx, query, blockerID, blockedID)
	if err != nil {
		return fmt.Errorf("failed to delete user block: %w", err)
	}

	if event != nil {
		insertOutbox := `
			INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status, partition_key) 
			VALUES ($1, $2, $3, $4, $5, 0, $6)
		`
		_, err = tx.ExecContext(ctx, insertOutbox, snowflake.GenerateID(), event.AggregateType, event.AggregateID, event.EventType, event.Payload, event.PartitionKey)
		if err != nil {
			return fmt.Errorf("failed to insert outbox event: %w", err)
		}
	}

	return tx.Commit()
}

func (r *pgRepository) IsBlocked(ctx context.Context, blockerID, blockedID int64) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2)`
	var exists bool
	err := r.db.QueryRowContext(ctx, query, blockerID, blockedID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check block: %w", err)
	}
	return exists, nil
}

func (r *pgRepository) CheckMutualBlock(ctx context.Context, userA, userB int64) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1 FROM user_blocks 
			WHERE (blocker_id = $1 AND blocked_id = $2) 
			   OR (blocker_id = $2 AND blocked_id = $1)
		)
	`
	var exists bool
	err := r.db.QueryRowContext(ctx, query, userA, userB).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check mutual block: %w", err)
	}
	return exists, nil
}

func (r *pgRepository) GetBlockedUsers(ctx context.Context, blockerID int64) ([]int64, error) {
	query := `SELECT blocked_id FROM user_blocks WHERE blocker_id = $1 ORDER BY created_at DESC`
	rows, err := r.db.QueryContext(ctx, query, blockerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get blocked users: %w", err)
	}
	defer rows.Close()

	var list []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("failed to scan blocked id: %w", err)
		}
		list = append(list, id)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration error: %w", err)
	}
	return list, nil
}
