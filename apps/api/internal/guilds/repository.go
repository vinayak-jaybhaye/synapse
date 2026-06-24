package guilds

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/synapse/api/internal/snowflake"
)

type Repository interface {
	CreateGuildTx(ctx context.Context, g *Guild) error
	GetByID(ctx context.Context, id int64) (*Guild, error)
	GetMember(ctx context.Context, guildID, userID int64) (*GuildMember, error)
	ListMembersCursor(ctx context.Context, guildID, afterUserID int64, limit int) ([]MemberWithUser, error)
	UpdateMember(ctx context.Context, m *GuildMember) error
}

type pgRepository struct {
	db *sql.DB
}

func NewPGRepository(db *sql.DB) Repository {
	return &pgRepository{db: db}
}

func (r *pgRepository) CreateGuildTx(ctx context.Context, g *Guild) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin guild creation tx: %w", err)
	}
	defer tx.Rollback()

	// 1. Insert Guild
	insertGuild := `
		INSERT INTO guilds (id, owner_id, name, description, icon_key, version, created_at, updated_at) 
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err = tx.ExecContext(ctx, insertGuild, g.ID, g.OwnerID, g.Name, g.Description, g.IconKey, g.Version, g.CreatedAt, g.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert guild: %w", err)
	}

	// 2. Generate @everyone Default Role
	roleID := snowflake.GenerateID()
	insertDefaultRole := `
		INSERT INTO roles (id, guild_id, name, color, position, permissions, is_default, version) 
		VALUES ($1, $2, '@everyone', 0, 0, 1049600, TRUE, 1) -- 1049600 contains view channel & read history permissions
	`
	_, err = tx.ExecContext(ctx, insertDefaultRole, roleID, g.ID)
	if err != nil {
		return fmt.Errorf("failed to insert default role: %w", err)
	}

	// 3. Add Owner to Members
	insertMember := `
		INSERT INTO guild_members (guild_id, user_id, nickname, joined_at, is_muted) 
		VALUES ($1, $2, NULL, NOW(), FALSE)
	`
	_, err = tx.ExecContext(ctx, insertMember, g.ID, g.OwnerID)
	if err != nil {
		return fmt.Errorf("failed to insert owner member: %w", err)
	}

	// 4. Bind Owner to Default Role
	insertMemberRole := `
		INSERT INTO member_roles (guild_id, user_id, role_id) 
		VALUES ($1, $2, $3)
	`
	_, err = tx.ExecContext(ctx, insertMemberRole, g.ID, g.OwnerID, roleID)
	if err != nil {
		return fmt.Errorf("failed to bind owner to default role: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit guild creation tx: %w", err)
	}

	return nil
}

func (r *pgRepository) GetByID(ctx context.Context, id int64) (*Guild, error) {
	query := `
		SELECT id, owner_id, name, description, icon_key, version, created_at, updated_at 
		FROM guilds 
		WHERE id = $1 AND deleted_at IS NULL
	`
	var g Guild
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&g.ID, &g.OwnerID, &g.Name, &g.Description, &g.IconKey, &g.Version, &g.CreatedAt, &g.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get guild: %w", err)
	}
	return &g, nil
}

func (r *pgRepository) GetMember(ctx context.Context, guildID, userID int64) (*GuildMember, error) {
	query := `
		SELECT guild_id, user_id, nickname, joined_at, is_muted 
		FROM guild_members 
		WHERE guild_id = $1 AND user_id = $2
	`
	var m GuildMember
	err := r.db.QueryRowContext(ctx, query, guildID, userID).Scan(
		&m.GuildID, &m.UserID, &m.Nickname, &m.JoinedAt, &m.IsMuted,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get guild member: %w", err)
	}
	return &m, nil
}

func (r *pgRepository) ListMembersCursor(ctx context.Context, guildID, afterUserID int64, limit int) ([]MemberWithUser, error) {
	query := `
		SELECT m.guild_id, m.user_id, u.username, u.display_name, u.avatar_key, m.nickname, m.joined_at, m.is_muted 
		FROM guild_members m
		INNER JOIN users u ON m.user_id = u.id
		WHERE m.guild_id = $1 AND m.user_id > $2
		ORDER BY m.user_id ASC
		LIMIT $3
	`
	rows, err := r.db.QueryContext(ctx, query, guildID, afterUserID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query guild members cursor: %w", err)
	}
	defer rows.Close()

	var list []MemberWithUser
	for rows.Next() {
		var mu MemberWithUser
		err := rows.Scan(
			&mu.GuildID, &mu.UserID, &mu.Username, &mu.DisplayName, &mu.AvatarKey, &mu.Nickname, &mu.JoinedAt, &mu.IsMuted,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan member row: %w", err)
		}
		list = append(list, mu)
	}
	return list, nil
}

func (r *pgRepository) UpdateMember(ctx context.Context, m *GuildMember) error {
	query := `
		UPDATE guild_members 
		SET nickname = $1, is_muted = $2 
		WHERE guild_id = $3 AND user_id = $4
	`
	_, err := r.db.ExecContext(ctx, query, m.Nickname, m.IsMuted, m.GuildID, m.UserID)
	if err != nil {
		return fmt.Errorf("failed to update guild member: %w", err)
	}
	return nil
}
