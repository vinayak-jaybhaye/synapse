package notifications

import (
	"context"

	"github.com/synapse/api/internal/channels"
	"github.com/synapse/api/internal/errors"
	"github.com/synapse/api/internal/guilds"
	"github.com/synapse/api/internal/permissions"
)

type Service interface {
	GetUserSettings(ctx context.Context, userID int64) ([]NotificationSettings, error)
	PutSettings(ctx context.Context, userID int64, guildID, channelID *int64, req *PutNotificationSettingsRequest) (*NotificationSettings, error)
}

type service struct {
	repo        Repository
	guildRepo   guilds.Repository
	channelRepo channels.Repository
	permService permissions.Service
}

func NewService(repo Repository, guildRepo guilds.Repository, channelRepo channels.Repository, permService permissions.Service) Service {
	return &service{
		repo:        repo,
		guildRepo:   guildRepo,
		channelRepo: channelRepo,
		permService: permService,
	}
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
