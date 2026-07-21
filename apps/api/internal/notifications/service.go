package notifications

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/synapse/api/internal/channels"
	"github.com/synapse/api/internal/errors"
	"github.com/synapse/api/internal/events"
	"github.com/synapse/api/internal/guilds"
	"github.com/synapse/api/internal/permissions"
)

type Service interface {
	GetUserSettings(ctx context.Context, userID int64) ([]NotificationSettings, error)
	PutSettings(ctx context.Context, userID int64, guildID, channelID *int64, req *PutNotificationSettingsRequest) (*NotificationSettings, error)

	// Core Notification methods
	CanNotify(ctx context.Context, userID int64, notifType NotificationType) (bool, error)
	GetInbox(ctx context.Context, userID int64, beforeID *int64, limit int) ([]NotificationResponse, error)
	GetUnreadCount(ctx context.Context, userID int64) (int, error)
	MarkRead(ctx context.Context, userID, notificationID int64) error
	MarkAllRead(ctx context.Context, userID int64) error
	Delete(ctx context.Context, userID, notificationID int64) error
}

type service struct {
	repo        Repository
	guildRepo   guilds.Repository
	channelRepo channels.Repository
	permService permissions.Service
	rdb         *redis.Client
	eventBus    events.EventBus
}

func NewService(repo Repository, guildRepo guilds.Repository, channelRepo channels.Repository, permService permissions.Service, rdb *redis.Client, bus events.EventBus) Service {
	s := &service{
		repo:        repo,
		guildRepo:   guildRepo,
		channelRepo: channelRepo,
		permService: permService,
		rdb:         rdb,
		eventBus:    bus,
	}
	s.registerSubscribers()
	return s
}

func (s *service) GetUserSettings(ctx context.Context, userID int64) ([]NotificationSettings, error) {
	return s.repo.GetUserSettings(ctx, userID)
}

func (s *service) PutSettings(ctx context.Context, userID int64, guildID, channelID *int64, req *PutNotificationSettingsRequest) (*NotificationSettings, error) {
	// Validate notification scope
	// 1. Global (guild_id == nil && channel_id == nil)
	// 2. Guild (guild_id != nil && channel_id == nil)
	// 3. Channel (guild_id == nil && channel_id != nil)

	if guildID != nil && channelID != nil {
		return nil, errors.NewBadRequest("invalid scope: cannot specify both guild_id and channel_id")
	}

	if guildID != nil {
		// Verify user is a member of the guild
		member, err := s.guildRepo.GetMember(ctx, *guildID, userID)
		if err != nil {
			return nil, err
		}
		if member == nil {
			return nil, errors.NewForbidden("access denied: you must be a member of this guild to configure its notifications")
		}
	} else if channelID != nil {
		// Verify the channel exists
		ch, err := s.channelRepo.GetByID(ctx, *channelID)
		if err != nil {
			return nil, err
		}
		if ch == nil {
			return nil, errors.NewNotFound("channel not found")
		}

		if ch.GuildID != nil {
			// Verify user is a member and has VIEW_CHANNEL permission
			allowed, err := s.permService.HasChannelPermission(ctx, *ch.GuildID, ch.ID, userID, permissions.VIEW_CHANNEL)
			if err != nil {
				return nil, err
			}
			if !allowed {
				return nil, errors.NewForbidden("access denied: view channel permission required")
			}
		} else {
			// Verify user is a DM participant
			isParticipant, err := s.repo.IsDMParticipant(ctx, ch.ID, userID)
			if err != nil {
				return nil, err
			}
			if !isParticipant {
				return nil, errors.NewForbidden("access denied: you are not a participant of this conversation")
			}
		}
	}

	settings := &NotificationSettings{
		UserID:    userID,
		GuildID:   guildID,
		ChannelID: channelID,
		MuteUntil: req.MuteUntil,
	}

	err := s.repo.PutSettings(ctx, settings)
	if err != nil {
		return nil, err
	}

	return settings, nil
}

func (s *service) registerSubscribers() {
	if s.eventBus == nil {
		return
	}
	s.eventBus.Subscribe(events.DomainEventMessageCreated{}, s.handleMessageCreated)
	s.eventBus.Subscribe(events.DomainEventReactionAdded{}, s.handleReactionAdded)
	s.eventBus.Subscribe(events.DomainEventFriendRequestCreated{}, s.handleFriendRequestCreated)
	s.eventBus.Subscribe(events.DomainEventFriendRequestAccepted{}, s.handleFriendRequestAccepted)
}

func (s *service) CanNotify(ctx context.Context, userID int64, notifType NotificationType) (bool, error) {
	settings, err := s.repo.GetUserSettings(ctx, userID)
	if err != nil {
		return true, nil
	}
	now := time.Now()
	for _, setting := range settings {
		if setting.GuildID == nil && setting.ChannelID == nil {
			if setting.MuteUntil != nil && setting.MuteUntil.After(now) {
				return false, nil
			}
		}
	}
	return true, nil
}

func (s *service) GetInbox(ctx context.Context, userID int64, beforeID *int64, limit int) ([]NotificationResponse, error) {
	notifs, err := s.repo.GetInbox(ctx, userID, beforeID, limit)
	if err != nil {
		return nil, err
	}
	resp := make([]NotificationResponse, len(notifs))
	for i, n := range notifs {
		resp[i] = NotificationResponse{
			ID:            n.ID,
			RecipientID:   n.RecipientID,
			ActorID:       n.ActorID,
			Type:          n.Type,
			ReferenceType: n.ReferenceType,
			ReferenceID:   n.ReferenceID,
			Metadata:      n.Metadata,
			IsRead:        n.IsRead,
			ReadAt:        n.ReadAt,
			CreatedAt:     n.CreatedAt,
		}
	}
	return resp, nil
}

func (s *service) GetUnreadCount(ctx context.Context, userID int64) (int, error) {
	// Attempt to get from redis first
	key := fmt.Sprintf("notification:count:%d", userID)
	countStr, err := s.rdb.Get(ctx, key).Result()
	if err == nil {
		var count int
		fmt.Sscanf(countStr, "%d", &count)
		return count, nil
	}

	// Fallback to DB
	count, err := s.repo.GetUnreadCount(ctx, userID)
	if err != nil {
		return 0, err
	}

	// Set in redis
	s.rdb.Set(ctx, key, count, 0)
	return count, nil
}

func (s *service) MarkRead(ctx context.Context, userID, notificationID int64) error {
	err := s.repo.MarkRead(ctx, userID, notificationID)
	if err != nil {
		return err
	}

	s.decrementUnreadCount(ctx, userID, 1)

	payload, _ := json.Marshal(map[string]any{
		"id":           strconv.FormatInt(notificationID, 10),
		"recipient_id": strconv.FormatInt(userID, 10),
	})
	s.repo.InsertOutboxEvent(ctx, events.NotificationUpdated, userID, payload)

	return nil
}

func (s *service) MarkAllRead(ctx context.Context, userID int64) error {
	err := s.repo.MarkAllRead(ctx, userID)
	if err != nil {
		return err
	}

	// Reset unread count to 0
	s.rdb.Set(ctx, fmt.Sprintf("notification:count:%d", userID), 0, 0)

	payload, _ := json.Marshal(map[string]any{
		"recipient_id": strconv.FormatInt(userID, 10),
	})
	// A special payload for MarkAllRead might just use NotificationUpdated with no ID
	s.repo.InsertOutboxEvent(ctx, events.NotificationUpdated, userID, payload)

	return nil
}

func (s *service) Delete(ctx context.Context, userID, notificationID int64) error {
	wasUnread, err := s.repo.Delete(ctx, userID, notificationID)
	if err != nil {
		return err
	}

	if wasUnread {
		s.decrementUnreadCount(ctx, userID, 1)
	}
	s.rdb.Del(ctx, fmt.Sprintf("notification:count:%d", userID))

	payload, _ := json.Marshal(map[string]any{
		"id":           strconv.FormatInt(notificationID, 10),
		"recipient_id": strconv.FormatInt(userID, 10),
	})
	s.repo.InsertOutboxEvent(ctx, events.NotificationDeleted, userID, payload)

	return nil
}

func (s *service) incrementUnreadCount(ctx context.Context, userID int64) {
	key := fmt.Sprintf("notification:count:%d", userID)
	s.rdb.Incr(ctx, key)
}

func (s *service) decrementUnreadCount(ctx context.Context, userID int64, amount int64) {
	key := fmt.Sprintf("notification:count:%d", userID)
	s.rdb.DecrBy(ctx, key, amount)
}

func (s *service) handleMessageCreated(e interface{}) {
	event, ok := e.(events.DomainEventMessageCreated)
	if !ok {
		return
	}

	// For mentions
	for _, mentionedUserID := range event.MentionedUserIDs {
		// Ignore self mentions just in case
		if mentionedUserID == event.AuthorID {
			continue
		}

		canNotify, _ := s.CanNotify(event.Ctx, mentionedUserID, TypeMention)
		if !canNotify {
			continue
		}

		metadata, _ := json.Marshal(map[string]any{
			"channel_id": strconv.FormatInt(event.ChannelID, 10),
			"guild_id": func() *string {
				if event.GuildID != nil {
					s := strconv.FormatInt(*event.GuildID, 10)
					return &s
				}
				return nil
			}(),
		})

		dedupKey := fmt.Sprintf("MENTION:%d:%d", mentionedUserID, event.MessageID)

		notif := &Notification{
			RecipientID:      mentionedUserID,
			ActorID:          &event.AuthorID,
			Type:             TypeMention,
			ReferenceType:    RefMessage,
			ReferenceID:      event.MessageID,
			Metadata:         (*json.RawMessage)(&metadata),
			DeduplicationKey: &dedupKey,
		}

		err := s.repo.CreateOrUpdate(event.Ctx, notif)
		if err == nil {
			s.incrementUnreadCount(event.Ctx, mentionedUserID)
			payload, _ := json.Marshal(map[string]any{
				"id":           strconv.FormatInt(notif.ID, 10),
				"recipient_id": strconv.FormatInt(notif.RecipientID, 10),
				"type":         notif.Type,
			})
			s.repo.InsertOutboxEvent(event.Ctx, events.NotificationCreated, notif.RecipientID, payload)
		}
	}

	// For replies
	if event.ReplyToID != nil {
		parentAuthorID, err := s.repo.GetMessageAuthor(event.Ctx, *event.ReplyToID)
		if err == nil && parentAuthorID != event.AuthorID {
			canNotify, _ := s.CanNotify(event.Ctx, parentAuthorID, TypeReply)
			if canNotify {
				metadata, _ := json.Marshal(map[string]any{
					"channel_id": strconv.FormatInt(event.ChannelID, 10),
					"guild_id": func() *string {
						if event.GuildID != nil {
							str := strconv.FormatInt(*event.GuildID, 10)
							return &str
						}
						return nil
					}(),
				})

				dedupKey := fmt.Sprintf("REPLY:%d:%d", parentAuthorID, event.MessageID)

				notif := &Notification{
					RecipientID:      parentAuthorID,
					ActorID:          &event.AuthorID,
					Type:             TypeReply,
					ReferenceType:    RefMessage,
					ReferenceID:      event.MessageID,
					Metadata:         (*json.RawMessage)(&metadata),
					DeduplicationKey: &dedupKey,
				}

				if err := s.repo.CreateOrUpdate(event.Ctx, notif); err == nil {
					s.incrementUnreadCount(event.Ctx, parentAuthorID)
					payload, _ := json.Marshal(map[string]any{
						"id":           strconv.FormatInt(notif.ID, 10),
						"recipient_id": strconv.FormatInt(notif.RecipientID, 10),
						"type":         notif.Type,
					})
					s.repo.InsertOutboxEvent(event.Ctx, events.NotificationCreated, notif.RecipientID, payload)
				}
			}
		}
	}
}

func (s *service) handleReactionAdded(e interface{}) {
	event, ok := e.(events.DomainEventReactionAdded)
	if !ok {
		return
	}

	if event.UserID == event.AuthorID {
		return // don't notify self reactions
	}

	canNotify, _ := s.CanNotify(event.Ctx, event.AuthorID, TypeReaction)
	if !canNotify {
		return
	}

	metadata, _ := json.Marshal(map[string]any{
		"channel_id": strconv.FormatInt(event.ChannelID, 10),
		"emoji":      event.Emoji,
	})

	dedupKey := fmt.Sprintf("REACTION:%d:%d:%s", event.AuthorID, event.MessageID, event.Emoji)

	notif := &Notification{
		RecipientID:      event.AuthorID,
		ActorID:          &event.UserID,
		Type:             TypeReaction,
		ReferenceType:    RefMessage,
		ReferenceID:      event.MessageID,
		Metadata:         (*json.RawMessage)(&metadata),
		DeduplicationKey: &dedupKey,
	}

	err := s.repo.CreateOrUpdate(event.Ctx, notif)
	if err == nil {
		s.incrementUnreadCount(event.Ctx, event.AuthorID)
		payload, _ := json.Marshal(map[string]any{
			"id":           strconv.FormatInt(notif.ID, 10),
			"recipient_id": strconv.FormatInt(notif.RecipientID, 10),
			"type":         notif.Type,
		})
		s.repo.InsertOutboxEvent(event.Ctx, events.NotificationCreated, notif.RecipientID, payload)
	}
}

func (s *service) handleFriendRequestCreated(e interface{}) {
	event, ok := e.(events.DomainEventFriendRequestCreated)
	if !ok {
		return
	}

	dedupKey := fmt.Sprintf("FRIEND_REQ:%d:%d", event.TargetID, event.RequesterID)
	notif := &Notification{
		RecipientID:      event.TargetID,
		ActorID:          &event.RequesterID,
		Type:             TypeFriendRequest,
		ReferenceType:    RefUser,
		ReferenceID:      event.RequesterID,
		DeduplicationKey: &dedupKey,
	}

	err := s.repo.CreateOrUpdate(event.Ctx, notif)
	if err == nil {
		s.incrementUnreadCount(event.Ctx, event.TargetID)
		payload, _ := json.Marshal(map[string]any{
			"id":           strconv.FormatInt(notif.ID, 10),
			"recipient_id": strconv.FormatInt(notif.RecipientID, 10),
			"type":         notif.Type,
		})
		s.repo.InsertOutboxEvent(event.Ctx, events.NotificationCreated, notif.RecipientID, payload)
	}
}

func (s *service) handleFriendRequestAccepted(e interface{}) {
	event, ok := e.(events.DomainEventFriendRequestAccepted)
	if !ok {
		return
	}

	dedupKey := fmt.Sprintf("FRIEND_ACC:%d:%d", event.RequesterID, event.TargetID)
	notif := &Notification{
		RecipientID:      event.RequesterID,
		ActorID:          &event.TargetID,
		Type:             TypeFriendAccepted,
		ReferenceType:    RefUser,
		ReferenceID:      event.TargetID,
		DeduplicationKey: &dedupKey,
	}

	err := s.repo.CreateOrUpdate(event.Ctx, notif)
	if err == nil {
		s.incrementUnreadCount(event.Ctx, event.RequesterID)
		payload, _ := json.Marshal(map[string]any{
			"id":           strconv.FormatInt(notif.ID, 10),
			"recipient_id": strconv.FormatInt(notif.RecipientID, 10),
			"type":         notif.Type,
		})
		s.repo.InsertOutboxEvent(event.Ctx, events.NotificationCreated, notif.RecipientID, payload)
	}
}
