package channels

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/synapse/api/internal/errors"
	"github.com/synapse/api/internal/media"
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
	GetRoleOverrides(ctx context.Context, channelID, userID int64) ([]ChannelRolePermissionOverride, error)
	PutRoleOverride(ctx context.Context, channelID, userID, roleID int64, req *PutRoleOverrideRequest) error
	DeleteRoleOverride(ctx context.Context, channelID, userID, roleID int64) error
	GenerateIconUploadURL(ctx context.Context, channelID, userID int64, req *media.UploadRequest) (*media.UploadResponse, error)
}

type service struct {
	repo         Repository
	roleRepo     roles.Repository
	mediaService media.Service
	permService  permissions.Service
}

func NewService(repo Repository, roleRepo roles.Repository, mediaService media.Service, permService permissions.Service) Service {
	return &service{repo: repo, roleRepo: roleRepo, mediaService: mediaService, permService: permService}
}

func (s *service) checkPermissions(ctx context.Context, guildID, userID int64, perm permissions.Permission) (bool, error) {
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

	var combined permissions.Permission
	for _, rl := range rlist {
		combined |= permissions.Permission(rl.Permissions)
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

	channels, err := s.repo.ListGuildChannels(ctx, guildID)
	if err != nil {
		return nil, err
	}

	var channelIDs []int64
	for _, ch := range channels {
		channelIDs = append(channelIDs, ch.ID)
	}

	if s.permService != nil {
		permsMap, err := s.permService.ResolveBatchChannelPermissions(ctx, guildID, userID, channelIDs)
		if err == nil {
			for i, ch := range channels {
				if perm, ok := permsMap[ch.ID]; ok {
					channels[i].Permissions = fmt.Sprintf("%d", perm)
				}
			}
		}
	}

	return channels, nil
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

func (s *service) GetRoleOverrides(ctx context.Context, channelID, userID int64) ([]ChannelRolePermissionOverride, error) {
	ch, err := s.repo.GetByID(ctx, channelID)
	if err != nil {
		return nil, err
	}
	if ch == nil || ch.GuildID == nil {
		return nil, errors.NewNotFound("channel not found")
	}

	allowed, err := s.checkPermissions(ctx, *ch.GuildID, userID, permissions.MANAGE_ROLES)
	if err != nil {
		return nil, err
	}
	if !allowed {
		allowed, err = s.checkPermissions(ctx, *ch.GuildID, userID, permissions.MANAGE_CHANNELS)
		if err != nil {
			return nil, err
		}
		if !allowed {
			return nil, errors.NewForbidden("insufficient permissions to view channel overrides")
		}
	}

	list, err := s.repo.GetRoleOverrides(ctx, channelID)
	if err != nil {
		return nil, err
	}
	for i := range list {
		list[i].AllowPermsString = strconv.FormatInt(list[i].AllowPermissions, 10)
		list[i].DenyPermsString = strconv.FormatInt(list[i].DenyPermissions, 10)
	}
	return list, nil
}

func (s *service) PutRoleOverride(ctx context.Context, channelID, userID, roleID int64, req *PutRoleOverrideRequest) error {
	ch, err := s.repo.GetByID(ctx, channelID)
	if err != nil {
		return err
	}
	if ch == nil || ch.GuildID == nil {
		return errors.NewNotFound("channel not found")
	}

	allowed, err := s.checkPermissions(ctx, *ch.GuildID, userID, permissions.MANAGE_ROLES)
	if err != nil {
		return err
	}
	if !allowed {
		allowed, err = s.checkPermissions(ctx, *ch.GuildID, userID, permissions.MANAGE_CHANNELS)
		if err != nil {
			return err
		}
		if !allowed {
			return errors.NewForbidden("insufficient permissions to manage channel overrides")
		}
	}

	allow, err := strconv.ParseInt(req.AllowPermissions, 10, 64)
	if err != nil {
		return errors.NewBadRequest("invalid allow_permissions")
	}
	deny, err := strconv.ParseInt(req.DenyPermissions, 10, 64)
	if err != nil {
		return errors.NewBadRequest("invalid deny_permissions")
	}

	override := &ChannelRolePermissionOverride{
		ChannelID:        channelID,
		RoleID:           roleID,
		AllowPermissions: allow,
		DenyPermissions:  deny,
	}

	return s.repo.PutRoleOverride(ctx, override)
}

func (s *service) DeleteRoleOverride(ctx context.Context, channelID, userID, roleID int64) error {
	ch, err := s.repo.GetByID(ctx, channelID)
	if err != nil {
		return err
	}
	if ch == nil || ch.GuildID == nil {
		return errors.NewNotFound("channel not found")
	}

	allowed, err := s.checkPermissions(ctx, *ch.GuildID, userID, permissions.MANAGE_ROLES)
	if err != nil {
		return err
	}
	if !allowed {
		allowed, err = s.checkPermissions(ctx, *ch.GuildID, userID, permissions.MANAGE_CHANNELS)
		if err != nil {
			return err
		}
		if !allowed {
			return errors.NewForbidden("insufficient permissions to manage channel overrides")
		}
	}

	return s.repo.DeleteRoleOverride(ctx, channelID, roleID)
}

func (s *service) GenerateIconUploadURL(ctx context.Context, channelID, userID int64, req *media.UploadRequest) (*media.UploadResponse, error) {
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
		return nil, errors.NewForbidden("insufficient permissions to manage channel icon")
	}

	req.Category = media.CategoryChannelIcon
	return s.mediaService.GenerateUploadURL(ctx, userID, channelID, req)
}
