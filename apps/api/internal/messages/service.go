package messages

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/synapse/api/internal/channels"
	"github.com/synapse/api/internal/errors"
	"github.com/synapse/api/internal/permissions"
	"github.com/synapse/api/internal/snowflake"
)

// Service defines the interface for core message actions.
type Service interface {
	GetMessages(ctx context.Context, channelID, userID, beforeID int64, limit int) ([]MessageResponse, error)
	SendMessage(ctx context.Context, channelID, userID int64, req *CreateMessageRequest) (*MessageResponse, error)
	EditMessage(ctx context.Context, channelID, messageID, userID int64, req *UpdateMessageRequest) (*MessageResponse, error)
	DeleteMessage(ctx context.Context, channelID, messageID, userID int64) error
	SyncReadState(ctx context.Context, channelID, userID, lastReadMessageID int64) error
	AddMessageReaction(ctx context.Context, channelID, messageID, userID int64, emoji string) error
	RemoveMessageReaction(ctx context.Context, channelID, messageID, userID int64, emoji string) error
}

type service struct {
	repo              Repository
	channelRepo       channels.Repository
	permissionService permissions.Service
	rdb               *redis.Client
}

// NewService creates a new messages Service using clean architecture dependencies.
func NewService(repo Repository, channelRepo channels.Repository, permissionService permissions.Service, rdb *redis.Client) Service {
	return &service{
		repo:              repo,
		channelRepo:       channelRepo,
		permissionService: permissionService,
		rdb:               rdb,
	}
}

// verifyChannelAccess checks that a user has access to a channel (view & specified permissions for guild channels; member verification for DMs).
func (s *service) verifyChannelAccess(ctx context.Context, channelID, userID int64, perms ...permissions.Permission) (*channels.Channel, error) {
	ch, err := s.channelRepo.GetByID(ctx, channelID)
	if err != nil {
		return nil, err
	}
	if ch == nil {
		return nil, errors.NewNotFound("channel not found")
	}

	if ch.GuildID != nil {
		// Guild Channel: Verify permission bitmask through the permissions engine
		mask, err := s.permissionService.ResolveChannelPermissions(ctx, *ch.GuildID, channelID, userID)
		if err != nil {
			return nil, err
		}
		if !permissions.HasAllPermissions(mask, perms...) {
			return nil, errors.NewForbidden("access denied: insufficient permissions in this channel")
		}
	} else {
		// DM Channel: Verify direct conversation membership
		isParticipant, err := s.repo.IsDMParticipant(ctx, channelID, userID)
		if err != nil {
			return nil, err
		}
		if !isParticipant {
			return nil, errors.NewForbidden("access denied: not a participant in this DM channel")
		}
	}

	return ch, nil
}

func (s *service) GetMessages(ctx context.Context, channelID, userID, beforeID int64, limit int) ([]MessageResponse, error) {
	_, err := s.verifyChannelAccess(ctx, channelID, userID, permissions.VIEW_CHANNEL, permissions.READ_MESSAGE_HISTORY)
	if err != nil {
		return nil, err
	}

	if limit <= 0 || limit > 100 {
		limit = 50
	}

	return s.repo.ListMessagesCursor(ctx, channelID, beforeID, limit)
}

func (s *service) SendMessage(ctx context.Context, channelID, userID int64, req *CreateMessageRequest) (*MessageResponse, error) {
	// 1. Content Length Validation
	if len(req.Content) == 0 {
		return nil, ErrContentEmpty
	}
	if len(req.Content) > 2000 {
		return nil, ErrContentTooLong
	}

	// 2. Channel Authorization Verification
	_, err := s.verifyChannelAccess(ctx, channelID, userID, permissions.SEND_MESSAGES)
	if err != nil {
		return nil, err
	}

	// 3. Optional Reply Parent Validation
	if req.ReplyToMessageID != nil {
		parent, err := s.repo.GetByID(ctx, *req.ReplyToMessageID)
		if err != nil {
			return nil, err
		}
		if parent == nil {
			return nil, ErrReplyTargetNotFound
		}
		if parent.ChannelID != channelID {
			return nil, ErrReplyTargetMismatch
		}
	}

	// 4. Construct Message
	msg := &Message{
		ID:               snowflake.GenerateID(),
		ChannelID:        channelID,
		AuthorID:         userID,
		ReplyToMessageID: req.ReplyToMessageID,
		MessageType:      0,
		Content:          req.Content,
		Metadata:         nil,
		CreatedAt:        time.Now(),
	}

	// 5. Build Outbox Event
	payloadMap := map[string]interface{}{
		"event_type": MessageCreatedEvent,
		"message_id": strconv.FormatInt(msg.ID, 10),
		"channel_id": strconv.FormatInt(msg.ChannelID, 10),
		"author_id":  strconv.FormatInt(msg.AuthorID, 10),
	}
	payloadBytes, err := json.Marshal(payloadMap)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal outbox event payload: %w", err)
	}

	event := &OutboxEvent{
		ID:            snowflake.GenerateID(),
		AggregateType: "channel",
		AggregateID:   channelID,
		EventType:     MessageCreatedEvent,
		Payload:       payloadBytes,
	}

	// 6. Persist Message and Outbox Event Atomically
	if err := s.repo.CreateMessageWithOutbox(ctx, msg, event); err != nil {
		return nil, err
	}

	return &MessageResponse{
		ID:               msg.ID,
		ChannelID:        msg.ChannelID,
		AuthorID:         msg.AuthorID,
		ReplyToMessageID: msg.ReplyToMessageID,
		MessageType:      msg.MessageType,
		Content:          msg.Content,
		CreatedAt:        msg.CreatedAt,
	}, nil
}

func (s *service) EditMessage(ctx context.Context, channelID, messageID, userID int64, req *UpdateMessageRequest) (*MessageResponse, error) {
	// 1. Content Length Validation
	if len(req.Content) == 0 {
		return nil, ErrContentEmpty
	}
	if len(req.Content) > 2000 {
		return nil, ErrContentTooLong
	}

	// 2. Load Message
	msg, err := s.repo.GetByID(ctx, messageID)
	if err != nil {
		return nil, err
	}
	if msg == nil || msg.ChannelID != channelID {
		return nil, errors.NewNotFound("message not found")
	}

	// 3. Verify Channel Access
	_, err = s.verifyChannelAccess(ctx, channelID, userID, permissions.VIEW_CHANNEL)
	if err != nil {
		return nil, err
	}

	// 4. Verify Requester is Message Author
	if msg.AuthorID != userID {
		return nil, errors.NewForbidden("cannot edit other user's message")
	}

	msg.Content = req.Content
	editedAt := time.Now()
	msg.EditedAt = &editedAt

	if err := s.repo.Update(ctx, msg); err != nil {
		return nil, err
	}

	return &MessageResponse{
		ID:               msg.ID,
		ChannelID:        msg.ChannelID,
		AuthorID:         msg.AuthorID,
		ReplyToMessageID: msg.ReplyToMessageID,
		MessageType:      msg.MessageType,
		Content:          msg.Content,
		CreatedAt:        msg.CreatedAt,
		EditedAt:         msg.EditedAt,
	}, nil
}

func (s *service) DeleteMessage(ctx context.Context, channelID, messageID, userID int64) error {
	// 1. Load Message
	msg, err := s.repo.GetByID(ctx, messageID)
	if err != nil {
		return err
	}
	if msg == nil || msg.ChannelID != channelID {
		return errors.NewNotFound("message not found")
	}

	// 2. Verify Channel Access (Requires VIEW_CHANNEL / DM member verification)
	ch, err := s.verifyChannelAccess(ctx, channelID, userID, permissions.VIEW_CHANNEL)
	if err != nil {
		return err
	}

	// 3. Verify Deletion Permissions
	if msg.AuthorID != userID {
		// Non-authors can never delete other users' messages in DM channels
		if ch.GuildID == nil {
			return errors.NewForbidden("cannot delete another user's message in a DM")
		}

		// In Guild Channels, deleting someone else's message requires MANAGE_MESSAGES permission
		mask, err := s.permissionService.ResolveChannelPermissions(ctx, *ch.GuildID, channelID, userID)
		if err != nil {
			return err
		}
		if !permissions.HasAllPermissions(mask, permissions.MANAGE_MESSAGES) {
			return errors.NewForbidden("insufficient permissions to delete message")
		}
	}

	return s.repo.SoftDelete(ctx, messageID)
}

func (s *service) SyncReadState(ctx context.Context, channelID, userID, lastReadMessageID int64) error {
	// 1. Verify access to channel
	_, err := s.verifyChannelAccess(ctx, channelID, userID, permissions.VIEW_CHANNEL)
	if err != nil {
		return err
	}

	// 2. Update read receipt cache in Redis (Source of Truth for unread checks)
	redisKey := fmt.Sprintf("channel_reads:%d", userID)
	field := strconv.FormatInt(channelID, 10)
	val := strconv.FormatInt(lastReadMessageID, 10)

	if s.rdb != nil {
		err = s.rdb.HSet(ctx, redisKey, field, val).Err()
		if err != nil {
			return fmt.Errorf("failed to write read marker to redis cache: %w", err)
		}
	}

	return nil
}

func (s *service) AddMessageReaction(ctx context.Context, channelID, messageID, userID int64, emoji string) error {
	_, err := s.verifyChannelAccess(ctx, channelID, userID, permissions.VIEW_CHANNEL, permissions.ADD_REACTIONS)
	if err != nil {
		return err
	}

	msg, err := s.repo.GetByID(ctx, messageID)
	if err != nil {
		return err
	}
	if msg == nil || msg.ChannelID != channelID {
		return errors.NewNotFound("message not found")
	}

	return s.repo.AddReaction(ctx, messageID, userID, emoji)
}

func (s *service) RemoveMessageReaction(ctx context.Context, channelID, messageID, userID int64, emoji string) error {
	_, err := s.verifyChannelAccess(ctx, channelID, userID, permissions.VIEW_CHANNEL)
	if err != nil {
		return err
	}

	msg, err := s.repo.GetByID(ctx, messageID)
	if err != nil {
		return err
	}
	if msg == nil || msg.ChannelID != channelID {
		return errors.NewNotFound("message not found")
	}

	return s.repo.RemoveReaction(ctx, messageID, userID, emoji)
}
