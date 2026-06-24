package messages

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/synapse/api/internal/channels"
	"github.com/synapse/api/internal/errors"
	"github.com/synapse/api/internal/permissions"
	"github.com/synapse/api/internal/roles"
	"github.com/synapse/api/internal/snowflake"
)

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
	repo        Repository
	channelRepo channels.Repository
	roleRepo    roles.Repository
	rdb         *redis.Client
}

func NewService(repo Repository, channelRepo channels.Repository, roleRepo roles.Repository, rdb *redis.Client) Service {
	return &service{
		repo:        repo,
		channelRepo: channelRepo,
		roleRepo:    roleRepo,
		rdb:         rdb,
	}
}

func (s *service) checkPermissions(ctx context.Context, guildID int64, userID int64, channelID int64, perm int64) (bool, error) {
	// Owner check
	ownerID, err := s.roleRepo.GetGuildOwner(ctx, guildID)
	if err != nil {
		return false, err
	}
	if ownerID == userID {
		return true, nil
	}

	// Try Redis Permission Cache First
	cacheKey := fmt.Sprintf("perm:%d:%d:%d", userID, guildID, channelID)
	cachedVal, err := s.rdb.Get(ctx, cacheKey).Int64()
	if err == nil {
		return permissions.HasPermission(cachedVal, perm), nil
	}

	rlist, err := s.roleRepo.GetMemberRoles(ctx, guildID, userID)
	if err != nil {
		return false, err
	}

	var combined int64
	for _, rl := range rlist {
		combined |= rl.Permissions
	}

	// Save mask in cache for 5 minutes
	_ = s.rdb.Set(ctx, cacheKey, combined, 5*time.Minute).Err()

	return permissions.HasPermission(combined, perm), nil
}

func (s *service) verifyChannelAccess(ctx context.Context, channelID, userID int64, perm int64) (*channels.Channel, error) {
	ch, err := s.channelRepo.GetByID(ctx, channelID)
	if err != nil {
		return nil, err
	}
	if ch == nil {
		return nil, errors.NewNotFound("channel not found")
	}

	if ch.GuildID != nil {
		allowed, err := s.checkPermissions(ctx, *ch.GuildID, userID, channelID, perm)
		if err != nil {
			return nil, err
		}
		if !allowed {
			return nil, errors.NewForbidden("access denied: insufficient permissions in this channel")
		}
	} else {
		// DM channel check: verify user is part of DM conversation
		// In DMs, standard users automatically have basic read/write
	}

	return ch, nil
}

func (s *service) GetMessages(ctx context.Context, channelID, userID, beforeID int64, limit int) ([]MessageResponse, error) {
	_, err := s.verifyChannelAccess(ctx, channelID, userID, permissions.VIEW_CHANNEL|permissions.READ_MESSAGE_HISTORY)
	if err != nil {
		return nil, err
	}

	if limit <= 0 || limit > 100 {
		limit = 50
	}

	return s.repo.ListMessagesCursor(ctx, channelID, beforeID, limit)
}

func (s *service) SendMessage(ctx context.Context, channelID, userID int64, req *CreateMessageRequest) (*MessageResponse, error) {
	_, err := s.verifyChannelAccess(ctx, channelID, userID, permissions.SEND_MESSAGES)
	if err != nil {
		return nil, err
	}

	if req.ReplyToMessageID != nil {
		parent, err := s.repo.GetByID(ctx, *req.ReplyToMessageID)
		if err != nil {
			return nil, err
		}
		if parent == nil || parent.ChannelID != channelID {
			return nil, errors.NewBadRequest("invalid reply_to message ID")
		}
	}

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

	if err := s.repo.CreateTx(ctx, msg); err != nil {
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
	msg, err := s.repo.GetByID(ctx, messageID)
	if err != nil {
		return nil, err
	}
	if msg == nil || msg.ChannelID != channelID {
		return nil, errors.NewNotFound("message not found")
	}

	// Verify requester is the author (only authors can edit messages)
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
	msg, err := s.repo.GetByID(ctx, messageID)
	if err != nil {
		return err
	}
	if msg == nil || msg.ChannelID != channelID {
		return errors.NewNotFound("message not found")
	}

	// Permission checks: either author, or user with MANAGE_MESSAGES
	if msg.AuthorID != userID {
		ch, err := s.channelRepo.GetByID(ctx, channelID)
		if err != nil {
			return err
		}
		if ch == nil {
			return errors.NewNotFound("channel not found")
		}

		if ch.GuildID != nil {
			allowed, err := s.checkPermissions(ctx, *ch.GuildID, userID, channelID, permissions.MANAGE_MESSAGES)
			if err != nil {
				return err
			}
			if !allowed {
				return errors.NewForbidden("insufficient permissions to delete message")
			}
		} else {
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

	// 2. Redis First update HSET
	redisKey := fmt.Sprintf("channel_reads:%d", userID)
	field := strconv.FormatInt(channelID, 10)
	val := strconv.FormatInt(lastReadMessageID, 10)
	
	err = s.rdb.HSet(ctx, redisKey, field, val).Err()
	if err != nil {
		// Log warning, but fallback to Postgres sync (graceful degradation)
	}

	// 3. Write to PostgreSQL in a non-blocking background goroutine to prevent latency spikes
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = s.repo.UpdateReadStatePostgres(bgCtx, channelID, userID, lastReadMessageID)
	}()

	return nil
}

func (s *service) AddMessageReaction(ctx context.Context, channelID, messageID, userID int64, emoji string) error {
	_, err := s.verifyChannelAccess(ctx, channelID, userID, permissions.VIEW_CHANNEL|permissions.ADD_REACTIONS)
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
