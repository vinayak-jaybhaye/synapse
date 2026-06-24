package permissions

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

type pgRoleRepository struct {
	db *sql.DB
}

// NewPGRoleRepository creates a new Postgres-backed RoleRepository.
func NewPGRoleRepository(db *sql.DB) RoleRepository {
	return &pgRoleRepository{db: db}
}

func (r *pgRoleRepository) GetMemberRoles(ctx context.Context, guildID int64, userID int64) ([]Role, error) {
	query := `
		SELECT r.id, r.permissions, r.is_default
		FROM roles r
		INNER JOIN member_roles mr ON r.id = mr.role_id
		WHERE mr.guild_id = $1 AND mr.user_id = $2
		UNION
		SELECT id, permissions, is_default
		FROM roles
		WHERE guild_id = $1 AND is_default = TRUE
	`
	rows, err := r.db.QueryContext(ctx, query, guildID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query member roles: %w", err)
	}
	defer rows.Close()

	var list []Role
	for rows.Next() {
		var rl Role
		var perms int64
		if err := rows.Scan(&rl.ID, &perms, &rl.IsDefault); err != nil {
			return nil, fmt.Errorf("failed to scan member role row: %w", err)
		}
		rl.Permissions = Permission(perms)
		list = append(list, rl)
	}
	return list, nil
}

func (r *pgRoleRepository) IsMember(ctx context.Context, guildID int64, userID int64) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM guild_members WHERE guild_id = $1 AND user_id = $2)`
	var exists bool
	err := r.db.QueryRowContext(ctx, query, guildID, userID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check guild membership: %w", err)
	}
	return exists, nil
}

type pgChannelPermissionRepository struct {
	db *sql.DB
}

// NewPGChannelPermissionRepository creates a new Postgres-backed ChannelPermissionRepository.
func NewPGChannelPermissionRepository(db *sql.DB) ChannelPermissionRepository {
	return &pgChannelPermissionRepository{db: db}
}

func (r *pgChannelPermissionRepository) GetRoleOverrides(ctx context.Context, channelID int64) ([]ChannelRolePermission, error) {
	query := `
		SELECT channel_id, role_id, allow_permissions, deny_permissions
		FROM channel_role_permissions
		WHERE channel_id = $1
	`
	rows, err := r.db.QueryContext(ctx, query, channelID)
	if err != nil {
		return nil, fmt.Errorf("failed to query channel role overrides: %w", err)
	}
	defer rows.Close()

	var list []ChannelRolePermission
	for rows.Next() {
		var o ChannelRolePermission
		var allow, deny int64
		if err := rows.Scan(&o.ChannelID, &o.RoleID, &allow, &deny); err != nil {
			return nil, fmt.Errorf("failed to scan channel override row: %w", err)
		}
		o.AllowPermissions = Permission(allow)
		o.DenyPermissions = Permission(deny)
		list = append(list, o)
	}
	return list, nil
}

func (r *pgChannelPermissionRepository) GetChannelGuildID(ctx context.Context, channelID int64) (int64, error) {
	query := `SELECT guild_id FROM channels WHERE id = $1 AND deleted_at IS NULL`
	var guildID sql.NullInt64
	err := r.db.QueryRowContext(ctx, query, channelID).Scan(&guildID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, ErrChannelNotFound
		}
		return 0, fmt.Errorf("failed to query channel guild ID: %w", err)
	}
	if !guildID.Valid {
		// DM channels have NULL guild_id, but the repository returns 0 or similar.
		// Wait, let's return 0 so the caller knows it is a DM channel.
		return 0, nil
	}
	return guildID.Int64, nil
}
