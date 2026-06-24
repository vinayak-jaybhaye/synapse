package auth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/synapse/api/internal/snowflake"
)

type pgUserRepository struct {
	db *sql.DB
}

func NewPGUserRepository(db *sql.DB) UserRepository {
	return &pgUserRepository{db: db}
}

func (r *pgUserRepository) CreateUser(ctx context.Context, u *User) error {
	// Check if user already exists
	var exists bool
	checkQuery := `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1 OR username = $2)`
	err := r.db.QueryRowContext(ctx, checkQuery, u.Email, u.Username).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check existing user: %w", err)
	}
	if exists {
		return ErrUserExists
	}

	u.ID = snowflake.GenerateID()
	u.CreatedAt = time.Now()
	u.UpdatedAt = time.Now()

	query := `INSERT INTO users (id, username, display_name, email, password_hash, avatar_key, created_at, updated_at) 
	          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`

	displayName := u.Username
	if u.DisplayName != "" {
		displayName = u.DisplayName
	}

	_, err = r.db.ExecContext(ctx, query, u.ID, u.Username, displayName, u.Email, u.PasswordHash, u.AvatarKey, u.CreatedAt, u.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert user in pg: %w", err)
	}
	return nil
}

func (r *pgUserRepository) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	query := `SELECT id, username, display_name, email, password_hash, avatar_key, created_at, updated_at FROM users WHERE email = $1`
	var u User
	var displayName sql.NullString
	var avatarKey sql.NullString
	err := r.db.QueryRowContext(ctx, query, email).Scan(
		&u.ID, &u.Username, &displayName, &u.Email, &u.PasswordHash, &avatarKey, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	if displayName.Valid {
		u.DisplayName = displayName.String
	}
	if avatarKey.Valid {
		u.AvatarKey = avatarKey.String
	}
	return &u, nil
}

func (r *pgUserRepository) GetUserByID(ctx context.Context, id int64) (*User, error) {
	query := `SELECT id, username, display_name, email, password_hash, avatar_key, created_at, updated_at FROM users WHERE id = $1`
	var u User
	var displayName sql.NullString
	var avatarKey sql.NullString
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&u.ID, &u.Username, &displayName, &u.Email, &u.PasswordHash, &avatarKey, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	if displayName.Valid {
		u.DisplayName = displayName.String
	}
	if avatarKey.Valid {
		u.AvatarKey = avatarKey.String
	}
	return &u, nil
}
