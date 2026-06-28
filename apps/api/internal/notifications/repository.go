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
