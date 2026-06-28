package guilds

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"

	"github.com/lib/pq"
	"github.com/synapse/api/internal/snowflake"
)

type Repository interface {
	CreateGuildTx(ctx context.Context, g *Guild) error
	GetByID(ctx context.Context, id int64) (*Guild, error)
	GetMember(ctx context.Context, guildID, userID int64) (*GuildMember, error)
	ListMembersCursor(ctx context.Context, guildID, afterUserID int64, limit int) ([]MemberWithUser, error)
	UpdateMember(ctx context.Context, m *GuildMember) error
	UpdateGuild(ctx context.Context, g *Guild) error
	RemoveMember(ctx context.Context, guildID, userID int64) error
	BanMember(ctx context.Context, guildID, userID, bannedByID int64, reason string) error
	ListBans(ctx context.Context, guildID int64) ([]BanWithUser, error)
	RemoveBan(ctx context.Context, guildID, userID int64) error
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
		VALUES ($1, $2, '@everyone', 0, 0, 104188993, TRUE, 1) -- 104188993 includes basic permissions like sending messages, viewing channels, reacting, etc.
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
		SELECT id, owner_id, name, description, icon_key, banner_key, version, created_at, updated_at 
		FROM guilds 
		WHERE id = $1 AND deleted_at IS NULL
	`
	var g Guild
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&g.ID, &g.OwnerID, &g.Name, &g.Description, &g.IconKey, &g.BannerKey, &g.Version, &g.CreatedAt, &g.UpdatedAt,
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
		mu.Roles = []string{}
		list = append(list, mu)
	}

	if len(list) == 0 {
		return list, nil
	}

	userIDs := make([]int64, len(list))
	userIndex := make(map[int64]int)
	for i, mu := range list {
		userIDs[i] = mu.UserID
		userIndex[mu.UserID] = i
	}

	roleQuery := `
		SELECT user_id, role_id 
		FROM member_roles 
		WHERE guild_id = $1 AND user_id = ANY($2)
	`
	roleRows, err := r.db.QueryContext(ctx, roleQuery, guildID, pq.Array(userIDs))
	if err != nil {
		return nil, fmt.Errorf("failed to query member roles: %w", err)
	}
	defer roleRows.Close()

	for roleRows.Next() {
		var uID, rID int64
		if err := roleRows.Scan(&uID, &rID); err != nil {
			return nil, fmt.Errorf("failed to scan member role row: %w", err)
		}
		if idx, ok := userIndex[uID]; ok {
			list[idx].Roles = append(list[idx].Roles, strconv.FormatInt(rID, 10))
		}
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

func (r *pgRepository) UpdateGuild(ctx context.Context, g *Guild) error {
	query := `UPDATE guilds SET name = $1, description = $2, icon_key = $3, banner_key = $4, updated_at = NOW(), version = version + 1 WHERE id = $5 AND deleted_at IS NULL`
	_, err := r.db.ExecContext(ctx, query, g.Name, g.Description, g.IconKey, g.BannerKey, g.ID)
	return err
}

func (r *pgRepository) RemoveMember(ctx context.Context, guildID, userID int64) error {
	query := `DELETE FROM guild_members WHERE guild_id = $1 AND user_id = $2`
	_, err := r.db.ExecContext(ctx, query, guildID, userID)
	if err != nil {
		return fmt.Errorf("failed to remove guild member: %w", err)
	}
	return nil
}

func (r *pgRepository) BanMember(ctx context.Context, guildID, userID, bannedByID int64, reason string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin ban tx: %w", err)
	}
	defer tx.Rollback()

	// 1. Delete member
	deleteQuery := `DELETE FROM guild_members WHERE guild_id = $1 AND user_id = $2`
	_, err = tx.ExecContext(ctx, deleteQuery, guildID, userID)
	if err != nil {
		return fmt.Errorf("failed to remove guild member in ban tx: %w", err)
	}

	// 2. Insert ban
	banQuery := `
		INSERT INTO guild_bans (guild_id, user_id, banned_by, reason, created_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (guild_id, user_id) DO UPDATE SET reason = EXCLUDED.reason, banned_by = EXCLUDED.banned_by, created_at = NOW()
	`
	_, err = tx.ExecContext(ctx, banQuery, guildID, userID, bannedByID, reason)
	if err != nil {
		return fmt.Errorf("failed to insert ban: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit ban tx: %w", err)
	}
	return nil
}

func (r *pgRepository) ListBans(ctx context.Context, guildID int64) ([]BanWithUser, error) {
	query := `
		SELECT gb.guild_id, gb.user_id, u.username, u.display_name, u.avatar_key, gb.reason, gb.banned_by, gb.created_at
		FROM guild_bans gb
		INNER JOIN users u ON gb.user_id = u.id
		WHERE gb.guild_id = $1
		ORDER BY gb.created_at DESC
	`
	rows, err := r.db.QueryContext(ctx, query, guildID)
	if err != nil {
		return nil, fmt.Errorf("failed to list guild bans: %w", err)
	}
	defer rows.Close()

	var list []BanWithUser
	for rows.Next() {
		var b BanWithUser
		var displayName sql.NullString
		var avatarKey sql.NullString
		var reason sql.NullString
		err := rows.Scan(
			&b.GuildID, &b.UserID, &b.Username, &displayName, &avatarKey, &reason, &b.BannedBy, &b.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan ban row: %w", err)
		}
		if displayName.Valid {
			b.DisplayName = &displayName.String
		}
		if avatarKey.Valid {
			b.AvatarKey = &avatarKey.String
		}
		if reason.Valid {
			b.Reason = &reason.String
		}
		list = append(list, b)
	}
	return list, nil
}

func (r *pgRepository) RemoveBan(ctx context.Context, guildID, userID int64) error {
	query := `DELETE FROM guild_bans WHERE guild_id = $1 AND user_id = $2`
	_, err := r.db.ExecContext(ctx, query, guildID, userID)
	if err != nil {
		return fmt.Errorf("failed to remove ban: %w", err)
	}
	return nil
}
