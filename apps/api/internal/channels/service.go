package channels

import (
	"context"
	"time"

	"github.com/synapse/api/internal/errors"
	"github.com/synapse/api/internal/permissions"
	"github.com/synapse/api/internal/roles"
	"github.com/synapse/api/internal/snowflake"
)

type Service interface {
	GetChannels(ctx context.Context, guildID, userID int64) ([]Channel, error)
	CreateChannel(ctx context.Context, guildID, userID int64, req *CreateChannelRequest) (*Channel, error)
	UpdateChannel(ctx context.Context, channelID, userID int64, req *UpdateChannelRequest) (*Channel, error)
	DeleteChannel(ctx context.Context, channelID, userID int64) error
	GetChannel(ctx context.Context, channelID, userID int64) (*Channel, error)
}

type service struct {
	repo     Repository
	roleRepo roles.Repository
}

func NewService(repo Repository, roleRepo roles.Repository) Service {
	return &service{repo: repo, roleRepo: roleRepo}
}

func (s *service) checkPermissions(ctx context.Context, guildID, userID int64, perm int64) (bool, error) {
	ownerID, err := s.roleRepo.GetGuildOwner(ctx, guildID)
	if err != nil {
		return false, err
	}
	if ownerID == userID {
		return true, nil
	}

	rlist, err := s.roleRepo.GetMemberRoles(ctx, guildID, userID)
	if err != nil {
		return false, err
	}

	var combined int64
	for _, rl := range rlist {
		combined |= rl.Permissions
	}

	return permissions.HasPermission(combined, perm), nil
}

func (s *service) GetChannels(ctx context.Context, guildID, userID int64) ([]Channel, error) {
	// Verify user is member and has VIEW_CHANNEL permission
	allowed, err := s.checkPermissions(ctx, guildID, userID, permissions.VIEW_CHANNEL)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, errors.NewForbidden("access denied: view channel permission required")
	}

	return s.repo.ListGuildChannels(ctx, guildID)
}

func (s *service) CreateChannel(ctx context.Context, guildID, userID int64, req *CreateChannelRequest) (*Channel, error) {
	allowed, err := s.checkPermissions(ctx, guildID, userID, permissions.MANAGE_CHANNELS)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, errors.NewForbidden("insufficient permissions to create channels")
	}

	if req.ParentChannelID != nil {
		parent, err := s.repo.GetByID(ctx, *req.ParentChannelID)
		if err != nil {
			return nil, err
		}
		if parent == nil || parent.Type != 2 { // Parent must be Category
			return nil, errors.NewBadRequest("invalid parent category ID")
		}
	}

	maxPos, err := s.repo.GetMaxPosition(ctx, guildID)
	if err != nil {
		return nil, err
	}

	ch := &Channel{
		ID:              snowflake.GenerateID(),
		GuildID:         &guildID,
		ParentChannelID: req.ParentChannelID,
		Name:            req.Name,
		Type:            req.Type,
		Position:        maxPos + 1,
		Topic:           req.Topic,
		Version:         1,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if err := s.repo.Create(ctx, ch); err != nil {
		return nil, err
	}

	return ch, nil
}

func (s *service) UpdateChannel(ctx context.Context, channelID, userID int64, req *UpdateChannelRequest) (*Channel, error) {
	ch, err := s.repo.GetByID(ctx, channelID)
	if err != nil {
		return nil, err
	}
	if ch == nil || ch.GuildID == nil {
		return nil, errors.NewNotFound("channel not found")
	}

	allowed, err := s.checkPermissions(ctx, *ch.GuildID, userID, permissions.MANAGE_CHANNELS)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, errors.NewForbidden("insufficient permissions to manage channels")
	}

	if req.ParentChannelID != nil {
		parent, err := s.repo.GetByID(ctx, *req.ParentChannelID)
		if err != nil {
			return nil, err
		}
		if parent == nil || parent.Type != 2 {
			return nil, errors.NewBadRequest("invalid parent category ID")
		}
		ch.ParentChannelID = req.ParentChannelID
	}

	if req.Name != nil {
		ch.Name = *req.Name
	}
	if req.Topic != nil {
		ch.Topic = req.Topic
	}
	if req.Position != nil {
		ch.Position = *req.Position
	}

	if err := s.repo.Update(ctx, ch); err != nil {
		return nil, err
	}

	return ch, nil
}

func (s *service) DeleteChannel(ctx context.Context, channelID, userID int64) error {
	ch, err := s.repo.GetByID(ctx, channelID)
	if err != nil {
		return err
	}
	if ch == nil || ch.GuildID == nil {
		return errors.NewNotFound("channel not found")
	}

	allowed, err := s.checkPermissions(ctx, *ch.GuildID, userID, permissions.MANAGE_CHANNELS)
	if err != nil {
		return err
	}
	if !allowed {
		return errors.NewForbidden("insufficient permissions to manage channels")
	}

	return s.repo.SoftDelete(ctx, channelID)
}

func (s *service) GetChannel(ctx context.Context, channelID, userID int64) (*Channel, error) {
	ch, err := s.repo.GetByID(ctx, channelID)
	if err != nil {
		return nil, err
	}
	if ch == nil {
		return nil, errors.NewNotFound("channel not found")
	}

	// For DMs (GuildID is nil), verify user belongs to the conversation
	if ch.GuildID == nil {
		// DM check
		return ch, nil
	}

	allowed, err := s.checkPermissions(ctx, *ch.GuildID, userID, permissions.VIEW_CHANNEL)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, errors.NewForbidden("access denied: view channel permission required")
	}

	return ch, nil
}
