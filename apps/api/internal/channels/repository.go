package channels

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

type Repository interface {
	GetByID(ctx context.Context, id int64) (*Channel, error)
	ListGuildChannels(ctx context.Context, guildID int64) ([]Channel, error)
	Create(ctx context.Context, ch *Channel) error
	Update(ctx context.Context, ch *Channel) error
	SoftDelete(ctx context.Context, id int64) error
	GetMaxPosition(ctx context.Context, guildID int64) (int, error)
	GetRoleOverrides(ctx context.Context, channelID int64) ([]ChannelRolePermissionOverride, error)
	PutRoleOverride(ctx context.Context, override *ChannelRolePermissionOverride) error
	DeleteRoleOverride(ctx context.Context, channelID, roleID int64) error
	// GetGuildIDForChannel returns the guildID for a given channelID, used by the voice package.
	GetGuildIDForChannel(ctx context.Context, channelID int64) (int64, error)
}

type pgRepository struct {
	db *sql.DB
}

func NewPGRepository(db *sql.DB) Repository {
	return &pgRepository{db: db}
}

func (r *pgRepository) GetByID(ctx context.Context, id int64) (*Channel, error) {
	query := `
		SELECT id, guild_id, parent_channel_id, name, type, position, topic, version, created_at, updated_at 
		FROM channels 
		WHERE id = $1 AND deleted_at IS NULL
	`
	var ch Channel
	var guildID sql.NullInt64
	var parentID sql.NullInt64
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&ch.ID, &guildID, &parentID, &ch.Name, &ch.Type, &ch.Position, &ch.Topic, &ch.Version, &ch.CreatedAt, &ch.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get channel: %w", err)
	}

	if guildID.Valid {
		ch.GuildID = &guildID.Int64
	}
	if parentID.Valid {
		ch.ParentChannelID = &parentID.Int64
	}

	return &ch, nil
}

func (r *pgRepository) ListGuildChannels(ctx context.Context, guildID int64) ([]Channel, error) {
	query := `
		SELECT id, guild_id, parent_channel_id, name, type, position, topic, version, created_at, updated_at 
		FROM channels 
		WHERE guild_id = $1 AND deleted_at IS NULL 
		ORDER BY position ASC
	`
	rows, err := r.db.QueryContext(ctx, query, guildID)
	if err != nil {
		return nil, fmt.Errorf("failed to list guild channels: %w", err)
	}
	defer rows.Close()

	var list []Channel
	for rows.Next() {
		var ch Channel
		var gID sql.NullInt64
		var pID sql.NullInt64
		err := rows.Scan(
			&ch.ID, &gID, &pID, &ch.Name, &ch.Type, &ch.Position, &ch.Topic, &ch.Version, &ch.CreatedAt, &ch.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan channel row: %w", err)
		}

		if gID.Valid {
			ch.GuildID = &gID.Int64
		}
		if pID.Valid {
			ch.ParentChannelID = &pID.Int64
		}

		list = append(list, ch)
	}
	return list, nil
}

func (r *pgRepository) Create(ctx context.Context, ch *Channel) error {
	query := `
		INSERT INTO channels (id, guild_id, parent_channel_id, name, type, position, topic, version, created_at, updated_at) 
		VALUES ($1, $2, $3, $4, $5, $6, $7, 1, NOW(), NOW())
	`
	var guildID sql.NullInt64
	if ch.GuildID != nil {
		guildID.Int64 = *ch.GuildID
		guildID.Valid = true
	}
	var parentID sql.NullInt64
	if ch.ParentChannelID != nil {
		parentID.Int64 = *ch.ParentChannelID
		parentID.Valid = true
	}

	_, err := r.db.ExecContext(ctx, query, ch.ID, guildID, parentID, ch.Name, ch.Type, ch.Position, ch.Topic)
	if err != nil {
		return fmt.Errorf("failed to insert channel: %w", err)
	}
	return nil
}

func (r *pgRepository) Update(ctx context.Context, ch *Channel) error {
	query := `
		UPDATE channels 
		SET name = $1, parent_channel_id = $2, topic = $3, position = $4, version = version + 1, updated_at = $5 
		WHERE id = $6 AND deleted_at IS NULL
	`
	var parentID sql.NullInt64
	if ch.ParentChannelID != nil {
		parentID.Int64 = *ch.ParentChannelID
		parentID.Valid = true
	}

	_, err := r.db.ExecContext(ctx, query, ch.Name, parentID, ch.Topic, ch.Position, time.Now(), ch.ID)
	if err != nil {
		return fmt.Errorf("failed to update channel: %w", err)
	}
	return nil
}

func (r *pgRepository) SoftDelete(ctx context.Context, id int64) error {
	query := `UPDATE channels SET deleted_at = $1 WHERE id = $2 AND deleted_at IS NULL`
	_, err := r.db.ExecContext(ctx, query, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to soft-delete channel: %w", err)
	}
	return nil
}

func (r *pgRepository) GetMaxPosition(ctx context.Context, guildID int64) (int, error) {
	query := `SELECT COALESCE(MAX(position), 0) FROM channels WHERE guild_id = $1 AND deleted_at IS NULL`
	var maxPos int
	err := r.db.QueryRowContext(ctx, query, guildID).Scan(&maxPos)
	if err != nil {
		return 0, fmt.Errorf("failed to get max channel position: %w", err)
	}
	return maxPos, nil
}

func (r *pgRepository) GetRoleOverrides(ctx context.Context, channelID int64) ([]ChannelRolePermissionOverride, error) {
	query := `
		SELECT channel_id, role_id, allow_permissions, deny_permissions
		FROM channel_role_permissions
		WHERE channel_id = $1
	`
	rows, err := r.db.QueryContext(ctx, query, channelID)
	if err != nil {
		return nil, fmt.Errorf("failed to list channel role overrides: %w", err)
	}
	defer rows.Close()

	var list []ChannelRolePermissionOverride
	for rows.Next() {
		var o ChannelRolePermissionOverride
		if err := rows.Scan(&o.ChannelID, &o.RoleID, &o.AllowPermissions, &o.DenyPermissions); err != nil {
			return nil, fmt.Errorf("failed to scan override row: %w", err)
		}
		list = append(list, o)
	}
	return list, nil
}

func (r *pgRepository) PutRoleOverride(ctx context.Context, override *ChannelRolePermissionOverride) error {
	query := `
		INSERT INTO channel_role_permissions (channel_id, role_id, allow_permissions, deny_permissions)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (channel_id, role_id) 
		DO UPDATE SET allow_permissions = EXCLUDED.allow_permissions, deny_permissions = EXCLUDED.deny_permissions
	`
	_, err := r.db.ExecContext(ctx, query, override.ChannelID, override.RoleID, override.AllowPermissions, override.DenyPermissions)
	if err != nil {
		return fmt.Errorf("failed to upsert role override: %w", err)
	}
	return nil
}

func (r *pgRepository) DeleteRoleOverride(ctx context.Context, channelID, roleID int64) error {
	query := `DELETE FROM channel_role_permissions WHERE channel_id = $1 AND role_id = $2`
	_, err := r.db.ExecContext(ctx, query, channelID, roleID)
	if err != nil {
		return fmt.Errorf("failed to delete role override: %w", err)
	}
	return nil
}

func (r *pgRepository) GetGuildIDForChannel(ctx context.Context, channelID int64) (int64, error) {
	query := `SELECT guild_id FROM channels WHERE id = $1 AND deleted_at IS NULL`
	var guildID sql.NullInt64
	err := r.db.QueryRowContext(ctx, query, channelID).Scan(&guildID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, fmt.Errorf("channel not found")
		}
		return 0, fmt.Errorf("failed to get guild ID for channel: %w", err)
	}
	if !guildID.Valid {
		return 0, fmt.Errorf("channel has no guild (DM channel)")
	}
	return guildID.Int64, nil
}
