package users

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/synapse/api/internal/snowflake"
)

type Repository interface {
	GetByID(ctx context.Context, id int64) (*User, error)
	GetByEmail(ctx context.Context, email string) (*User, error)
	Create(ctx context.Context, user *User) error
	UpdateUser(ctx context.Context, u *User) error
	ListGuilds(ctx context.Context, userID int64) ([]UserGuildDTO, error)
	ListDMs(ctx context.Context, userID int64) ([]DMChannelResponse, error)
	CreateOrGetDM(ctx context.Context, creatorID, recipientID int64) (int64, error)
	GetUserProfile(ctx context.Context, requesterID, targetID int64) (*UserProfile, error)
}

type pgRepository struct {
	db *sql.DB
}

func NewPGRepository(db *sql.DB) Repository {
	return &pgRepository{db: db}
}

func (r *pgRepository) GetByID(ctx context.Context, id int64) (*User, error) {
	query := `SELECT id, username, display_name, email, password_hash, avatar_key, banner_key, bio, created_at, updated_at FROM users WHERE id = $1`
	var u User
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&u.ID, &u.Username, &u.DisplayName, &u.Email, &u.PasswordHash, &u.AvatarKey, &u.BannerKey, &u.Bio, &u.CreatedAt, &u.UpdatedAt,
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
	query := `SELECT id, username, display_name, email, password_hash, avatar_key, banner_key, bio, created_at, updated_at FROM users WHERE email = $1`
	var u User
	err := r.db.QueryRowContext(ctx, query, email).Scan(
		&u.ID, &u.Username, &u.DisplayName, &u.Email, &u.PasswordHash, &u.AvatarKey, &u.BannerKey, &u.Bio, &u.CreatedAt, &u.UpdatedAt,
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
	query := `INSERT INTO users (id, username, display_name, email, password_hash, avatar_key, banner_key, bio, created_at, updated_at) 
	          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`
	_, err := r.db.ExecContext(ctx, query, u.ID, u.Username, u.DisplayName, u.Email, u.PasswordHash, u.AvatarKey, u.BannerKey, u.Bio, u.CreatedAt, u.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert user: %w", err)
	}
	return nil
}

func (r *pgRepository) ListGuilds(ctx context.Context, userID int64) ([]UserGuildDTO, error) {
	query := `
		SELECT g.id, g.name, g.description, g.icon_key, g.banner_key, g.owner_id 
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
		if err := rows.Scan(&g.ID, &g.Name, &g.Description, &g.IconKey, &g.BannerKey, &g.OwnerID); err != nil {
			return nil, fmt.Errorf("failed to scan user guild row: %w", err)
		}
		guilds = append(guilds, g)
	}
	return guilds, nil
}

func (r *pgRepository) ListDMs(ctx context.Context, userID int64) ([]DMChannelResponse, error) {
	query := `
		SELECT dc.channel_id, u.id, u.username, u.display_name, u.avatar_key, u.banner_key, u.bio
		FROM direct_conversations dc
		INNER JOIN users u ON (u.id = dc.user1_id OR u.id = dc.user2_id) AND u.id != $1
		WHERE dc.user1_id = $1 OR dc.user2_id = $1
	`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query dms: %w", err)
	}
	defer rows.Close()

	var dms []DMChannelResponse
	for rows.Next() {
		var dm DMChannelResponse
		var uDisplayName sql.NullString
		var uAvatarKey sql.NullString
		var uBannerKey sql.NullString
		var uBio sql.NullString

		if err := rows.Scan(&dm.ChannelID, &dm.Recipient.ID, &dm.Recipient.Username, &uDisplayName, &uAvatarKey, &uBannerKey, &uBio); err != nil {
			return nil, fmt.Errorf("failed to scan dm row: %w", err)
		}

		dm.Recipient.DisplayName = uDisplayName.String
		dm.Recipient.AvatarKey = uAvatarKey.String
		dm.Recipient.BannerKey = uBannerKey.String
		dm.Recipient.Bio = uBio.String

		dms = append(dms, dm)
	}
	return dms, nil
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

	// Insert into outbox_events
	payloadBytes, _ := json.Marshal(map[string]any{
		"channel_id": fmt.Sprintf("%d", channelID),
		"user1_id":   fmt.Sprintf("%d", user1ID),
		"user2_id":   fmt.Sprintf("%d", user2ID),
	})
	// Use snowflake IDs instead of random() for strictly chronological event ordering across partitions.
	// Use 0 for status as the column is smallint, not a string ('PENDING').
	insertOutbox := `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status, partition_key) VALUES ($1, $2, $3, $4, $5, 0, $6)`
	_, err = tx.ExecContext(ctx, insertOutbox, snowflake.GenerateID(), "user", channelID, "USER_DM_CREATE", payloadBytes, int16(channelID%16))
	if err != nil {
		return 0, fmt.Errorf("failed to insert outbox event: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("failed to commit tx: %w", err)
	}

	return channelID, nil
}

func (r *pgRepository) GetUserProfile(ctx context.Context, requesterID, targetID int64) (*UserProfile, error) {
	query := `
		SELECT 
			u.id, 
			u.username, 
			u.display_name, 
			u.avatar_key, 
			u.banner_key, 
			u.bio, 
			u.created_at,
			(
				SELECT COUNT(*) 
				FROM guild_members gm1 
				INNER JOIN guild_members gm2 ON gm1.guild_id = gm2.guild_id 
				WHERE gm1.user_id = $1 AND gm2.user_id = $2
			) as mutual_guilds
		FROM users u
		WHERE u.id = $2
	`

	var profile UserProfile
	var displayName, avatarKey, bannerKey, bio sql.NullString

	err := r.db.QueryRowContext(ctx, query, requesterID, targetID).Scan(
		&profile.ID,
		&profile.Username,
		&displayName,
		&avatarKey,
		&bannerKey,
		&bio,
		&profile.CreatedAt,
		&profile.MutualGuilds,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get user profile: %w", err)
	}

	profile.DisplayName = displayName.String
	profile.AvatarKey = avatarKey.String
	profile.BannerKey = bannerKey.String
	profile.Bio = bio.String

	// Status will be integrated later when presence features are added
	profile.Status = "offline"

	return &profile, nil
}

func (r *pgRepository) UpdateUser(ctx context.Context, u *User) error {
	query := `UPDATE users SET display_name = $1, bio = $2, avatar_key = $3, banner_key = $4, updated_at = NOW() WHERE id = $5`
	_, err := r.db.ExecContext(ctx, query, u.DisplayName, u.Bio, u.AvatarKey, u.BannerKey, u.ID)
	return err
}
