package messages

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/lib/pq"
)

type Repository interface {
	GetByID(ctx context.Context, id int64) (*Message, error)
	ListMessagesCursor(ctx context.Context, channelID, beforeID int64, limit int) ([]MessageResponse, error)
	CreateMessageWithOutbox(ctx context.Context, msg *Message, event *OutboxEvent) error
	Update(ctx context.Context, msg *Message) error
	SoftDelete(ctx context.Context, id int64) error
	AddReaction(ctx context.Context, messageID, userID int64, emoji string) error
	RemoveReaction(ctx context.Context, messageID, userID int64, emoji string) error
	UpdateReadStatePostgres(ctx context.Context, channelID, userID, lastReadMessageID int64) error
	IsDMParticipant(ctx context.Context, channelID int64, userID int64) (bool, error)
}

type pgRepository struct {
	db *sql.DB
}

func NewPGRepository(db *sql.DB) Repository {
	return &pgRepository{db: db}
}

func scanReplyPreview(pID sql.NullInt64, pAuthorID sql.NullInt64, pUsername sql.NullString, pContent sql.NullString, pDeletedAt sql.NullTime) *ReplyPreview {
	if !pID.Valid {
		return nil
	}
	preview := &ReplyPreview{
		ID:       pID.Int64,
		AuthorID: pAuthorID.Int64,
		Username: pUsername.String,
	}
	if pDeletedAt.Valid {
		preview.Deleted = true
		preview.Content = ""
	} else {
		preview.Deleted = false
		preview.Content = pContent.String
	}
	return preview
}

func (r *pgRepository) GetByID(ctx context.Context, id int64) (*Message, error) {
	query := `
		SELECT 
			m.id, m.channel_id, m.author_id, m.reply_to_message_id, m.message_type, m.content, m.metadata, m.created_at, m.edited_at,
			p.id, p.author_id, pu.username, p.content, p.deleted_at,
			u.username, u.display_name, u.avatar_key, u.banner_key, u.bio
		FROM messages m
		LEFT JOIN messages p ON m.reply_to_message_id = p.id
		LEFT JOIN users pu ON p.author_id = pu.id
		LEFT JOIN users u ON m.author_id = u.id
		WHERE m.id = $1 AND m.deleted_at IS NULL
	`
	var msg Message
	var replyID sql.NullInt64

	var pID sql.NullInt64
	var pAuthorID sql.NullInt64
	var pUsername sql.NullString
	var pContent sql.NullString
	var pDeletedAt sql.NullTime

	var uUsername string
	var uDisplayName sql.NullString
	var uAvatarKey sql.NullString
	var uBannerKey sql.NullString
	var uBio sql.NullString

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&msg.ID, &msg.ChannelID, &msg.AuthorID, &replyID, &msg.MessageType, &msg.Content, &msg.Metadata, &msg.CreatedAt, &msg.EditedAt,
		&pID, &pAuthorID, &pUsername, &pContent, &pDeletedAt,
		&uUsername, &uDisplayName, &uAvatarKey, &uBannerKey, &uBio,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get message: %w", err)
	}

	if replyID.Valid {
		msg.ReplyToMessageID = &replyID.Int64
	}

	msg.ReplyPreview = scanReplyPreview(pID, pAuthorID, pUsername, pContent, pDeletedAt)
	
	msg.Author = UserSummary{
		ID:          msg.AuthorID,
		Username:    uUsername,
		DisplayName: uDisplayName.String,
		AvatarKey:   uAvatarKey.String,
		BannerKey:   uBannerKey.String,
		Bio:         uBio.String,
	}

	return &msg, nil
}

func (r *pgRepository) ListMessagesCursor(ctx context.Context, channelID, beforeID int64, limit int) ([]MessageResponse, error) {
	var query string
	var rows *sql.Rows
	var err error

	if beforeID > 0 {
		query = `
			SELECT 
				m.id, m.channel_id, m.author_id, m.reply_to_message_id, m.message_type, m.content, m.created_at, m.edited_at, m.deleted_at,
				p.id, p.author_id, pu.username, p.content, p.deleted_at,
				u.username, u.display_name, u.avatar_key, u.banner_key, u.bio
			FROM messages m
			LEFT JOIN messages p ON m.reply_to_message_id = p.id
			LEFT JOIN users pu ON p.author_id = pu.id
			LEFT JOIN users u ON m.author_id = u.id
			WHERE m.channel_id = $1 AND m.id < $2
			ORDER BY m.id DESC 
			LIMIT $3
		`
		rows, err = r.db.QueryContext(ctx, query, channelID, beforeID, limit)
	} else {
		query = `
			SELECT 
				m.id, m.channel_id, m.author_id, m.reply_to_message_id, m.message_type, m.content, m.created_at, m.edited_at, m.deleted_at,
				p.id, p.author_id, pu.username, p.content, p.deleted_at,
				u.username, u.display_name, u.avatar_key, u.banner_key, u.bio
			FROM messages m
			LEFT JOIN messages p ON m.reply_to_message_id = p.id
			LEFT JOIN users pu ON p.author_id = pu.id
			LEFT JOIN users u ON m.author_id = u.id
			WHERE m.channel_id = $1
			ORDER BY m.id DESC 
			LIMIT $2
		`
		rows, err = r.db.QueryContext(ctx, query, channelID, limit)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to query messages: %w", err)
	}
	defer rows.Close()

	var list []MessageResponse
	var messageIDs []int64
	for rows.Next() {
		var mr MessageResponse
		var replyID sql.NullInt64
		var deletedAt sql.NullTime

		var pID sql.NullInt64
		var pAuthorID sql.NullInt64
		var pUsername sql.NullString
		var pContent sql.NullString
		var pDeletedAt sql.NullTime

		var uUsername string
		var uDisplayName sql.NullString
		var uAvatarKey sql.NullString
		var uBannerKey sql.NullString
		var uBio sql.NullString

		err := rows.Scan(
			&mr.ID, &mr.ChannelID, &mr.AuthorID, &replyID, &mr.MessageType, &mr.Content, &mr.CreatedAt, &mr.EditedAt, &deletedAt,
			&pID, &pAuthorID, &pUsername, &pContent, &pDeletedAt,
			&uUsername, &uDisplayName, &uAvatarKey, &uBannerKey, &uBio,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan message row: %w", err)
		}

		if replyID.Valid {
			mr.ReplyToMessageID = &replyID.Int64
		}

		mr.ReplyPreview = scanReplyPreview(pID, pAuthorID, pUsername, pContent, pDeletedAt)

		mr.Author = UserSummary{
			ID:          mr.AuthorID,
			Username:    uUsername,
			DisplayName: uDisplayName.String,
			AvatarKey:   uAvatarKey.String,
			BannerKey:   uBannerKey.String,
			Bio:         uBio.String,
		}

		if deletedAt.Valid {
			mr.Deleted = true
			mr.Content = ""
		} else {
			mr.Deleted = false
		}
		mr.Reactions = []ReactionSummary{}

		list = append(list, mr)
		messageIDs = append(messageIDs, mr.ID)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error during message rows iteration: %w", err)
	}

	if len(messageIDs) == 0 {
		return list, nil
	}

	reactionQuery := `
		SELECT message_id, emoji, COUNT(*) AS count
		FROM message_reactions
		WHERE message_id = ANY($1)
		GROUP BY message_id, emoji
	`
	reactRows, err := r.db.QueryContext(ctx, reactionQuery, pq.Array(messageIDs))
	if err != nil {
		return nil, fmt.Errorf("failed to query message reactions: %w", err)
	}
	defer reactRows.Close()

	reactionsMap := make(map[int64][]ReactionSummary)
	for reactRows.Next() {
		var msgID int64
		var rs ReactionSummary
		if err := reactRows.Scan(&msgID, &rs.Emoji, &rs.Count); err != nil {
			return nil, fmt.Errorf("failed to scan reaction row: %w", err)
		}
		reactionsMap[msgID] = append(reactionsMap[msgID], rs)
	}

	if err = reactRows.Err(); err != nil {
		return nil, fmt.Errorf("error during reaction rows iteration: %w", err)
	}

	for i := range list {
		if summaries, ok := reactionsMap[list[i].ID]; ok {
			list[i].Reactions = summaries
		}
	}

	return list, nil
}

func (r *pgRepository) CreateMessageWithOutbox(ctx context.Context, msg *Message, event *OutboxEvent) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin message tx: %w", err)
	}
	defer tx.Rollback()

	// 1. Insert message
	query := `
		INSERT INTO messages (id, channel_id, author_id, reply_to_message_id, message_type, content, metadata, created_at) 
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	var replyID sql.NullInt64
	if msg.ReplyToMessageID != nil {
		replyID.Int64 = *msg.ReplyToMessageID
		replyID.Valid = true
	}

	_, err = tx.ExecContext(ctx, query, msg.ID, msg.ChannelID, msg.AuthorID, replyID, msg.MessageType, msg.Content, msg.Metadata, msg.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert message inside tx: %w", err)
	}

	// 2. Insert Outbox Event
	insertOutbox := `
		INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status) 
		VALUES ($1, $2, $3, $4, $5, 0)
	`
	_, err = tx.ExecContext(ctx, insertOutbox, event.ID, event.AggregateType, event.AggregateID, event.EventType, event.Payload)
	if err != nil {
		return fmt.Errorf("failed to insert outbox event inside tx: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit message tx: %w", err)
	}

	return nil
}

func (r *pgRepository) Update(ctx context.Context, msg *Message) error {
	query := `UPDATE messages SET content = $1, edited_at = $2 WHERE id = $3 AND deleted_at IS NULL`
	_, err := r.db.ExecContext(ctx, query, msg.Content, msg.EditedAt, msg.ID)
	if err != nil {
		return fmt.Errorf("failed to update message: %w", err)
	}
	return nil
}

func (r *pgRepository) SoftDelete(ctx context.Context, id int64) error {
	query := `UPDATE messages SET deleted_at = $1 WHERE id = $2 AND deleted_at IS NULL`
	_, err := r.db.ExecContext(ctx, query, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to soft-delete message: %w", err)
	}
	return nil
}

func (r *pgRepository) AddReaction(ctx context.Context, messageID, userID int64, emoji string) error {
	query := `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`
	_, err := r.db.ExecContext(ctx, query, messageID, userID, emoji)
	if err != nil {
		return fmt.Errorf("failed to add message reaction: %w", err)
	}
	return nil
}

func (r *pgRepository) RemoveReaction(ctx context.Context, messageID, userID int64, emoji string) error {
	query := `DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`
	_, err := r.db.ExecContext(ctx, query, messageID, userID, emoji)
	if err != nil {
		return fmt.Errorf("failed to remove message reaction: %w", err)
	}
	return nil
}

func (r *pgRepository) UpdateReadStatePostgres(ctx context.Context, channelID, userID, lastReadMessageID int64) error {
	query := `
		INSERT INTO channel_reads (channel_id, user_id, last_read_message_id, updated_at) 
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (channel_id, user_id) 
		DO UPDATE SET last_read_message_id = EXCLUDED.last_read_message_id, updated_at = NOW()
	`
	_, err := r.db.ExecContext(ctx, query, channelID, userID, lastReadMessageID)
	if err != nil {
		return fmt.Errorf("failed to upsert channel read marker in postgres: %w", err)
	}
	return nil
}

func (r *pgRepository) IsDMParticipant(ctx context.Context, channelID int64, userID int64) (bool, error) {
	query := `
		SELECT EXISTS (
			SELECT 1 FROM direct_conversations
			WHERE channel_id = $1 AND (user1_id = $2 OR user2_id = $2)
		)
	`
	var exists bool
	err := r.db.QueryRowContext(ctx, query, channelID, userID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check DM participant: %w", err)
	}
	return exists, nil
}
