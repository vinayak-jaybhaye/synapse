package notifications

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/synapse/api/internal/snowflake"
)

type Repository interface {
	GetUserSettings(ctx context.Context, userID int64) ([]NotificationSettings, error)
	PutSettings(ctx context.Context, settings *NotificationSettings) error
	IsDMParticipant(ctx context.Context, channelID, userID int64) (bool, error)

	// Inbox methods
	CreateOrUpdate(ctx context.Context, notif *Notification) error
	MarkRead(ctx context.Context, recipientID, notificationID int64) error
	MarkAllRead(ctx context.Context, recipientID int64) error
	Delete(ctx context.Context, recipientID, notificationID int64) (bool, error)
	GetInbox(ctx context.Context, recipientID int64, beforeID *int64, limit int) ([]Notification, error)
	GetUnreadCount(ctx context.Context, recipientID int64) (int, error)
	GetMessageAuthor(ctx context.Context, messageID int64) (int64, error)
	InsertOutboxEvent(ctx context.Context, eventType string, aggregateID int64, payload []byte) error
}

type pgRepository struct {
	db *sql.DB
}

func NewPGRepository(db *sql.DB) Repository {
	return &pgRepository{db: db}
}

func (r *pgRepository) GetUserSettings(ctx context.Context, userID int64) ([]NotificationSettings, error) {
	query := `
		SELECT id, user_id, guild_id, channel_id, mute_until, created_at, updated_at
		FROM notification_settings
		WHERE user_id = $1
	`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user notification settings: %w", err)
	}
	defer rows.Close()

	var list []NotificationSettings
	for rows.Next() {
		var s NotificationSettings
		var guildID sql.NullInt64
		var channelID sql.NullInt64
		err := rows.Scan(&s.ID, &s.UserID, &guildID, &channelID, &s.MuteUntil, &s.CreatedAt, &s.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan notification setting row: %w", err)
		}
		if guildID.Valid {
			s.GuildID = &guildID.Int64
		}
		if channelID.Valid {
			s.ChannelID = &channelID.Int64
		}
		list = append(list, s)
	}
	return list, nil
}

func (r *pgRepository) PutSettings(ctx context.Context, s *NotificationSettings) error {
	if s.ID == 0 {
		s.ID = snowflake.GenerateID()
	}

	query := `
		INSERT INTO notification_settings (id, user_id, guild_id, channel_id, mute_until, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
		ON CONFLICT (user_id, guild_id, channel_id)
		DO UPDATE SET mute_until = EXCLUDED.mute_until, updated_at = NOW()
		RETURNING id, created_at, updated_at
	`
	err := r.db.QueryRowContext(ctx, query, s.ID, s.UserID, s.GuildID, s.ChannelID, s.MuteUntil).Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to upsert notification settings: %w", err)
	}
	return nil
}

func (r *pgRepository) IsDMParticipant(ctx context.Context, channelID, userID int64) (bool, error) {
	query := `
		SELECT EXISTS (
			SELECT 1 FROM direct_conversations
			WHERE channel_id = $1 AND (user1_id = $2 OR user2_id = $2)
		)
	`
	var exists bool
	err := r.db.QueryRowContext(ctx, query, channelID, userID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check DM participant: %w", err)
	}
	return exists, nil
}

func (r *pgRepository) CreateOrUpdate(ctx context.Context, notif *Notification) error {
	if notif.ID == 0 {
		notif.ID = snowflake.GenerateID()
	}

	query := `
		INSERT INTO notifications (
			id, recipient_id, actor_id, type, reference_type, reference_id, metadata, deduplication_key, is_read, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
		)
		ON CONFLICT (recipient_id, deduplication_key) WHERE deduplication_key IS NOT NULL
		DO UPDATE SET
			metadata = EXCLUDED.metadata
		RETURNING id, is_read, read_at, created_at
	`
	err := r.db.QueryRowContext(
		ctx, query,
		notif.ID, notif.RecipientID, notif.ActorID, notif.Type, notif.ReferenceType,
		notif.ReferenceID, notif.Metadata, notif.DeduplicationKey, notif.IsRead,
	).Scan(&notif.ID, &notif.IsRead, &notif.ReadAt, &notif.CreatedAt)

	if err != nil {
		return fmt.Errorf("failed to create or update notification: %w", err)
	}

	return nil
}

func (r *pgRepository) MarkRead(ctx context.Context, recipientID, notificationID int64) error {
	query := `
		UPDATE notifications
		SET is_read = true, read_at = NOW()
		WHERE id = $1 AND recipient_id = $2 AND is_read = false
	`
	_, err := r.db.ExecContext(ctx, query, notificationID, recipientID)
	if err != nil {
		return fmt.Errorf("failed to mark notification read: %w", err)
	}
	return nil
}

func (r *pgRepository) MarkAllRead(ctx context.Context, recipientID int64) error {
	query := `
		UPDATE notifications
		SET is_read = true, read_at = NOW()
		WHERE recipient_id = $1 AND is_read = false
	`
	_, err := r.db.ExecContext(ctx, query, recipientID)
	if err != nil {
		return fmt.Errorf("failed to mark all notifications read: %w", err)
	}
	return nil
}

func (r *pgRepository) Delete(ctx context.Context, recipientID, notificationID int64) (bool, error) {
	query := `
		DELETE FROM notifications
		WHERE id = $1 AND recipient_id = $2
		RETURNING is_read
	`
	var isRead bool
	err := r.db.QueryRowContext(ctx, query, notificationID, recipientID).Scan(&isRead)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to delete notification: %w", err)
	}
	return !isRead, nil
}

func (r *pgRepository) GetInbox(ctx context.Context, recipientID int64, beforeID *int64, limit int) ([]Notification, error) {
	query := `
		SELECT id, recipient_id, actor_id, type, reference_type, reference_id, metadata, deduplication_key, is_read, read_at, created_at
		FROM notifications
		WHERE recipient_id = $1
	`
	args := []interface{}{recipientID}

	if beforeID != nil {
		query += ` AND id < $2`
		args = append(args, *beforeID)
	}

	query += fmt.Sprintf(` ORDER BY created_at DESC, id DESC LIMIT $%d`, len(args)+1)
	args = append(args, limit)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get inbox: %w", err)
	}
	defer rows.Close()

	var list []Notification
	for rows.Next() {
		var n Notification
		err := rows.Scan(
			&n.ID, &n.RecipientID, &n.ActorID, &n.Type, &n.ReferenceType,
			&n.ReferenceID, &n.Metadata, &n.DeduplicationKey, &n.IsRead,
			&n.ReadAt, &n.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan notification: %w", err)
		}
		list = append(list, n)
	}
	return list, nil
}

func (r *pgRepository) GetUnreadCount(ctx context.Context, recipientID int64) (int, error) {
	query := `SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND is_read = false`
	var count int
	err := r.db.QueryRowContext(ctx, query, recipientID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to get unread count: %w", err)
	}
	return count, nil
}

func (r *pgRepository) GetMessageAuthor(ctx context.Context, messageID int64) (int64, error) {
	query := `SELECT author_id FROM messages WHERE id = $1`
	var authorID int64
	err := r.db.QueryRowContext(ctx, query, messageID).Scan(&authorID)
	if err != nil {
		return 0, fmt.Errorf("failed to get message author: %w", err)
	}
	return authorID, nil
}

func (r *pgRepository) InsertOutboxEvent(ctx context.Context, eventType string, aggregateID int64, payload []byte) error {
	query := `
		INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status, partition_key)
		VALUES ($1, 'notification', $2, $3, $4, 0, $5)
	`
	id := snowflake.GenerateID()
	partitionKey := int16(aggregateID % 16)
	_, err := r.db.ExecContext(ctx, query, id, aggregateID, eventType, payload, partitionKey)
	if err != nil {
		return fmt.Errorf("failed to insert outbox event: %w", err)
	}
	return nil
}
