package invites

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

type Repository interface {
	Create(ctx context.Context, invite *Invite) error
	GetByCode(ctx context.Context, code string) (*Invite, error)
	GetInviteMetadata(ctx context.Context, code string) (*InviteMetadata, error)
	JoinGuildTx(ctx context.Context, code string, guildID, userID int64) error
	IsMember(ctx context.Context, guildID, userID int64) (bool, error)
	IsBanned(ctx context.Context, guildID, userID int64) (bool, error)
}

type pgRepository struct {
	db *sql.DB
}

func NewPGRepository(db *sql.DB) Repository {
	return &pgRepository{db: db}
}

func (r *pgRepository) Create(ctx context.Context, invite *Invite) error {
	query := `
		INSERT INTO invites (id, guild_id, created_by, code, expires_at, max_uses, uses, created_at) 
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err := r.db.ExecContext(ctx, query,
		invite.ID, invite.GuildID, invite.CreatedBy, invite.Code, invite.ExpiresAt, invite.MaxUses, invite.Uses, invite.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert invite: %w", err)
	}
	return nil
}

func (r *pgRepository) GetByCode(ctx context.Context, code string) (*Invite, error) {
	query := `
		SELECT id, guild_id, created_by, code, expires_at, max_uses, uses, created_at 
		FROM invites 
		WHERE code = $1
	`
	var invite Invite
	err := r.db.QueryRowContext(ctx, query, code).Scan(
		&invite.ID, &invite.GuildID, &invite.CreatedBy, &invite.Code, &invite.ExpiresAt, &invite.MaxUses, &invite.Uses, &invite.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get invite by code: %w", err)
	}
	return &invite, nil
}

func (r *pgRepository) GetInviteMetadata(ctx context.Context, code string) (*InviteMetadata, error) {
	// Query invite, guild info, and current members count
	query := `
		SELECT i.code, i.guild_id, g.name, g.icon_key, i.expires_at,
		       (SELECT COUNT(*) FROM guild_members WHERE guild_id = i.guild_id) as member_count
		FROM invites i
		INNER JOIN guilds g ON i.guild_id = g.id
		WHERE i.code = $1 AND g.deleted_at IS NULL
	`
	var m InviteMetadata
	err := r.db.QueryRowContext(ctx, query, code).Scan(
		&m.Code, &m.GuildID, &m.GuildName, &m.IconKey, &m.ExpiresAt, &m.MemberCount,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get invite metadata: %w", err)
	}
	return &m, nil
}

func (r *pgRepository) JoinGuildTx(ctx context.Context, code string, guildID, userID int64) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin join tx: %w", err)
	}
	defer tx.Rollback()

	// 1. Increment uses count
	incrementUses := `UPDATE invites SET uses = uses + 1 WHERE code = $1`
	_, err = tx.ExecContext(ctx, incrementUses, code)
	if err != nil {
		return fmt.Errorf("failed to update uses: %w", err)
	}

	// 2. Add to guild members
	insertMember := `
		INSERT INTO guild_members (guild_id, user_id, nickname, joined_at, is_muted) 
		VALUES ($1, $2, NULL, NOW(), FALSE)
	`
	_, err = tx.ExecContext(ctx, insertMember, guildID, userID)
	if err != nil {
		return fmt.Errorf("failed to insert member: %w", err)
	}

	// 3. Get Default @everyone Role ID of the guild
	roleQuery := `SELECT id FROM roles WHERE guild_id = $1 AND is_default = TRUE LIMIT 1`
	var defaultRoleID int64
	err = tx.QueryRowContext(ctx, roleQuery, guildID).Scan(&defaultRoleID)
	if err != nil {
		return fmt.Errorf("failed to retrieve @everyone role for guild: %w", err)
	}

	// 4. Bind Member to Default Role
	insertMemberRole := `
		INSERT INTO member_roles (guild_id, user_id, role_id) 
		VALUES ($1, $2, $3)
	`
	_, err = tx.ExecContext(ctx, insertMemberRole, guildID, userID, defaultRoleID)
	if err != nil {
		return fmt.Errorf("failed to insert default member role: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit join tx: %w", err)
	}

	return nil
}

func (r *pgRepository) IsMember(ctx context.Context, guildID, userID int64) (bool, error) {
	query := `SELECT EXISTS (SELECT 1 FROM guild_members WHERE guild_id = $1 AND user_id = $2)`
	var exists bool
	err := r.db.QueryRowContext(ctx, query, guildID, userID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check membership existence: %w", err)
	}
	return exists, nil
}

func (r *pgRepository) IsBanned(ctx context.Context, guildID, userID int64) (bool, error) {
	query := `SELECT EXISTS (SELECT 1 FROM guild_bans WHERE guild_id = $1 AND user_id = $2)`
	var exists bool
	err := r.db.QueryRowContext(ctx, query, guildID, userID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check ban existence: %w", err)
	}
	return exists, nil
}
