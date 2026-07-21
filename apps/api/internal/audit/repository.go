package audit

import (
	"context"
	"database/sql"
	"fmt"
)

type Repository interface {
	Create(ctx context.Context, entry *AuditLogEntry) error
	ListGuildLogs(ctx context.Context, guildID int64, filter AuditLogFilter) ([]AuditLogEntry, error)
}

type pgRepository struct {
	db *sql.DB
}

func NewPGRepository(db *sql.DB) Repository {
	return &pgRepository{db: db}
}

func (r *pgRepository) Create(ctx context.Context, entry *AuditLogEntry) error {
	query := `
		INSERT INTO audit_logs (
			id, guild_id, actor_id, actor_username, actor_display_name, actor_avatar_key,
			action, target_type, target_id, target_display, reason, changes, metadata, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
		)
	`
	_, err := r.db.ExecContext(
		ctx, query,
		entry.ID, entry.GuildID, entry.ActorID, entry.ActorUsername, entry.ActorDisplayName, entry.ActorAvatarKey,
		entry.Action, entry.TargetType, entry.TargetID, entry.TargetDisplay, entry.Reason, entry.Changes, entry.Metadata,
	)
	if err != nil {
		return fmt.Errorf("failed to insert audit log entry: %w", err)
	}
	return nil
}

func (r *pgRepository) ListGuildLogs(ctx context.Context, guildID int64, filter AuditLogFilter) ([]AuditLogEntry, error) {
	limit := filter.Limit
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	query := `
		SELECT id, guild_id, actor_id, actor_username, actor_display_name, actor_avatar_key,
		       action, target_type, target_id, target_display, reason, changes, metadata, created_at
		FROM audit_logs
		WHERE guild_id = $1
	`
	args := []interface{}{guildID}
	paramIdx := 2

	if filter.BeforeID != nil {
		query += fmt.Sprintf(" AND id < $%d", paramIdx)
		args = append(args, *filter.BeforeID)
		paramIdx++
	}

	if filter.Action != nil {
		query += fmt.Sprintf(" AND action = $%d", paramIdx)
		args = append(args, *filter.Action)
		paramIdx++
	}

	if filter.ActorID != nil {
		query += fmt.Sprintf(" AND actor_id = $%d", paramIdx)
		args = append(args, *filter.ActorID)
		paramIdx++
	}

	if filter.TargetType != nil {
		query += fmt.Sprintf(" AND target_type = $%d", paramIdx)
		args = append(args, *filter.TargetType)
		paramIdx++
	}

	if filter.TargetID != nil {
		query += fmt.Sprintf(" AND target_id = $%d", paramIdx)
		args = append(args, *filter.TargetID)
		paramIdx++
	}

	query += fmt.Sprintf(" ORDER BY id DESC LIMIT $%d", paramIdx)
	args = append(args, limit)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list guild audit logs: %w", err)
	}
	defer rows.Close()

	var entries []AuditLogEntry
	for rows.Next() {
		var e AuditLogEntry
		var actorID sql.NullInt64
		var actorDisplayName, actorAvatarKey, targetDisplay, reason sql.NullString

		err := rows.Scan(
			&e.ID, &e.GuildID, &actorID, &e.ActorUsername, &actorDisplayName, &actorAvatarKey,
			&e.Action, &e.TargetType, &e.TargetID, &targetDisplay, &reason, &e.Changes, &e.Metadata, &e.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan audit log entry: %w", err)
		}

		if actorID.Valid {
			e.ActorID = &actorID.Int64
		}
		if actorDisplayName.Valid {
			e.ActorDisplayName = actorDisplayName.String
		}
		if actorAvatarKey.Valid {
			e.ActorAvatarKey = actorAvatarKey.String
		}
		if targetDisplay.Valid {
			e.TargetDisplay = targetDisplay.String
		}
		if reason.Valid {
			e.Reason = &reason.String
		}

		entries = append(entries, e)
	}

	return entries, nil
}
