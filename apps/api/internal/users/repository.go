package users

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/synapse/api/internal/snowflake"
)

type Repository interface {
	GetByID(ctx context.Context, id int64) (*User, error)
	GetByEmail(ctx context.Context, email string) (*User, error)
	Create(ctx context.Context, user *User) error
	ListGuilds(ctx context.Context, userID int64) ([]UserGuildDTO, error)
	CreateOrGetDM(ctx context.Context, creatorID, recipientID int64) (int64, error)
}

type pgRepository struct {
	db *sql.DB
}

func NewPGRepository(db *sql.DB) Repository {
	return &pgRepository{db: db}
}

func (r *pgRepository) GetByID(ctx context.Context, id int64) (*User, error) {
	query := `SELECT id, username, display_name, email, password_hash, avatar_key, created_at, updated_at FROM users WHERE id = $1`
	var u User
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&u.ID, &u.Username, &u.DisplayName, &u.Email, &u.PasswordHash, &u.AvatarKey, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get user by id: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) GetByEmail(ctx context.Context, email string) (*User, error) {
	query := `SELECT id, username, display_name, email, password_hash, avatar_key, created_at, updated_at FROM users WHERE email = $1`
	var u User
	err := r.db.QueryRowContext(ctx, query, email).Scan(
		&u.ID, &u.Username, &u.DisplayName, &u.Email, &u.PasswordHash, &u.AvatarKey, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get user by email: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) Create(ctx context.Context, u *User) error {
	query := `INSERT INTO users (id, username, display_name, email, password_hash, avatar_key, created_at, updated_at) 
	          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	_, err := r.db.ExecContext(ctx, query, u.ID, u.Username, u.DisplayName, u.Email, u.PasswordHash, u.AvatarKey, u.CreatedAt, u.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert user: %w", err)
	}
	return nil
}

func (r *pgRepository) ListGuilds(ctx context.Context, userID int64) ([]UserGuildDTO, error) {
	query := `
		SELECT g.id, g.name, g.icon_key, g.owner_id 
		FROM guilds g
		INNER JOIN guild_members m ON g.id = m.guild_id
		WHERE m.user_id = $1 AND g.deleted_at IS NULL
		ORDER BY g.name ASC
	`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query user guilds: %w", err)
	}
	defer rows.Close()

	var guilds []UserGuildDTO
	for rows.Next() {
		var g UserGuildDTO
		if err := rows.Scan(&g.ID, &g.Name, &g.IconKey, &g.OwnerID); err != nil {
			return nil, fmt.Errorf("failed to scan user guild row: %w", err)
		}
		guilds = append(guilds, g)
	}
	return guilds, nil
}

func (r *pgRepository) CreateOrGetDM(ctx context.Context, creatorID, recipientID int64) (int64, error) {
	if creatorID == recipientID {
		return 0, errors.New("cannot create a DM with yourself")
	}

	// Order IDs canonically
	user1ID := creatorID
	user2ID := recipientID
	if user1ID > user2ID {
		user1ID, user2ID = user2ID, user1ID
	}

	// 1. Check if DM already exists
	checkQuery := `SELECT channel_id FROM direct_conversations WHERE user1_id = $1 AND user2_id = $2`
	var channelID int64
	err := r.db.QueryRowContext(ctx, checkQuery, user1ID, user2ID).Scan(&channelID)
	if err == nil {
		return channelID, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return 0, fmt.Errorf("failed to check existing DM: %w", err)
	}

	// 2. Doesn't exist, build new DM channel atomically
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to begin tx: %w", err)
	}
	defer tx.Rollback()

	// Insert into channels
	channelID = snowflake.GenerateID()
	insertChannel := `INSERT INTO channels (id, guild_id, parent_channel_id, name, type, position, topic) 
	                  VALUES ($1, NULL, NULL, 'dm', 3, 0, '')`
	_, err = tx.ExecContext(ctx, insertChannel, channelID)
	if err != nil {
		return 0, fmt.Errorf("failed to insert dm channel: %w", err)
	}

	// Insert into direct_conversations
	convID := snowflake.GenerateID()
	insertConv := `INSERT INTO direct_conversations (id, channel_id, user1_id, user2_id) 
	               VALUES ($1, $2, $3, $4)`
	_, err = tx.ExecContext(ctx, insertConv, convID, channelID, user1ID, user2ID)
	if err != nil {
		return 0, fmt.Errorf("failed to insert direct conversation: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("failed to commit tx: %w", err)
	}

	return channelID, nil
}
