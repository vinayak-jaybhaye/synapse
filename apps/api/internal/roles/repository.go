package roles

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

type Repository interface {
	GetByID(ctx context.Context, id int64) (*Role, error)
	ListRoles(ctx context.Context, guildID int64) ([]Role, error)
	Create(ctx context.Context, role *Role) error
	Update(ctx context.Context, role *Role) error
	Delete(ctx context.Context, id int64) error
	AddMemberRole(ctx context.Context, guildID, userID, roleID int64) error
	RemoveMemberRole(ctx context.Context, guildID, userID, roleID int64) error
	GetMemberRoles(ctx context.Context, guildID, userID int64) ([]Role, error)
	GetGuildOwner(ctx context.Context, guildID int64) (int64, error)
	GetMaxPosition(ctx context.Context, guildID int64) (int, error)
}

type pgRepository struct {
	db *sql.DB
}

func NewPGRepository(db *sql.DB) Repository {
	return &pgRepository{db: db}
}

func (r *pgRepository) GetByID(ctx context.Context, id int64) (*Role, error) {
	query := `SELECT id, guild_id, name, color, position, permissions, is_default, version FROM roles WHERE id = $1`
	var rl Role
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&rl.ID, &rl.GuildID, &rl.Name, &rl.Color, &rl.Position, &rl.Permissions, &rl.IsDefault, &rl.Version,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get role by id: %w", err)
	}
	return &rl, nil
}

func (r *pgRepository) ListRoles(ctx context.Context, guildID int64) ([]Role, error) {
	query := `SELECT id, guild_id, name, color, position, permissions, is_default, version FROM roles WHERE guild_id = $1 ORDER BY position DESC`
	rows, err := r.db.QueryContext(ctx, query, guildID)
	if err != nil {
		return nil, fmt.Errorf("failed to list roles: %w", err)
	}
	defer rows.Close()

	var list []Role
	for rows.Next() {
		var rl Role
		if err := rows.Scan(&rl.ID, &rl.GuildID, &rl.Name, &rl.Color, &rl.Position, &rl.Permissions, &rl.IsDefault, &rl.Version); err != nil {
			return nil, fmt.Errorf("failed to scan role row: %w", err)
		}
		list = append(list, rl)
	}
	return list, nil
}

func (r *pgRepository) Create(ctx context.Context, rl *Role) error {
	query := `INSERT INTO roles (id, guild_id, name, color, position, permissions, is_default, version) 
	          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	_, err := r.db.ExecContext(ctx, query, rl.ID, rl.GuildID, rl.Name, rl.Color, rl.Position, rl.Permissions, rl.IsDefault, rl.Version)
	if err != nil {
		return fmt.Errorf("failed to insert role: %w", err)
	}
	return nil
}

func (r *pgRepository) Update(ctx context.Context, rl *Role) error {
	query := `UPDATE roles SET name = $1, color = $2, position = $3, permissions = $4, version = version + 1 WHERE id = $5`
	_, err := r.db.ExecContext(ctx, query, rl.Name, rl.Color, rl.Position, rl.Permissions, rl.ID)
	if err != nil {
		return fmt.Errorf("failed to update role: %w", err)
	}
	return nil
}

func (r *pgRepository) Delete(ctx context.Context, id int64) error {
	query := `DELETE FROM roles WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete role: %w", err)
	}
	return nil
}

func (r *pgRepository) AddMemberRole(ctx context.Context, guildID, userID, roleID int64) error {
	query := `INSERT INTO member_roles (guild_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`
	_, err := r.db.ExecContext(ctx, query, guildID, userID, roleID)
	if err != nil {
		return fmt.Errorf("failed to add member role: %w", err)
	}
	return nil
}

func (r *pgRepository) RemoveMemberRole(ctx context.Context, guildID, userID, roleID int64) error {
	query := `DELETE FROM member_roles WHERE guild_id = $1 AND user_id = $2 AND role_id = $3`
	_, err := r.db.ExecContext(ctx, query, guildID, userID, roleID)
	if err != nil {
		return fmt.Errorf("failed to remove member role: %w", err)
	}
	return nil
}

func (r *pgRepository) GetMemberRoles(ctx context.Context, guildID, userID int64) ([]Role, error) {
	query := `
		SELECT r.id, r.guild_id, r.name, r.color, r.position, r.permissions, r.is_default, r.version 
		FROM roles r
		INNER JOIN member_roles mr ON r.id = mr.role_id
		WHERE mr.guild_id = $1 AND mr.user_id = $2
		UNION
		SELECT id, guild_id, name, color, position, permissions, is_default, version
		FROM roles
		WHERE guild_id = $1 AND is_default = TRUE
		ORDER BY position DESC
	`
	rows, err := r.db.QueryContext(ctx, query, guildID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get member roles: %w", err)
	}
	defer rows.Close()

	var list []Role
	for rows.Next() {
		var rl Role
		if err := rows.Scan(&rl.ID, &rl.GuildID, &rl.Name, &rl.Color, &rl.Position, &rl.Permissions, &rl.IsDefault, &rl.Version); err != nil {
			return nil, fmt.Errorf("failed to scan member role row: %w", err)
		}
		list = append(list, rl)
	}
	return list, nil
}

func (r *pgRepository) GetGuildOwner(ctx context.Context, guildID int64) (int64, error) {
	query := `SELECT owner_id FROM guilds WHERE id = $1`
	var ownerID int64
	err := r.db.QueryRowContext(ctx, query, guildID).Scan(&ownerID)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch guild owner: %w", err)
	}
	return ownerID, nil
}

func (r *pgRepository) GetMaxPosition(ctx context.Context, guildID int64) (int, error) {
	query := `SELECT COALESCE(MAX(position), 0) FROM roles WHERE guild_id = $1`
	var maxPos int
	err := r.db.QueryRowContext(ctx, query, guildID).Scan(&maxPos)
	if err != nil {
		return 0, fmt.Errorf("failed to get max role position: %w", err)
	}
	return maxPos, nil
}
