package channels

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/synapse/api/internal/audit"
	"github.com/synapse/api/internal/errors"
	"github.com/synapse/api/internal/events"
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
}

type service struct {
	repo         Repository
	roleRepo     roles.Repository
	mediaService media.Service
	permService  permissions.Service
	auditService audit.Service
}

func NewService(repo Repository, roleRepo roles.Repository, mediaService media.Service, permService permissions.Service, auditService audit.Service) Service {
	return &service{repo: repo, roleRepo: roleRepo, mediaService: mediaService, permService: permService, auditService: auditService}
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
	// List all guild channels
	channels, err := s.repo.ListGuildChannels(ctx, guildID)
	if err != nil {
		return nil, err
	}

	var channelIDs []int64
	for _, ch := range channels {
		channelIDs = append(channelIDs, ch.ID)
	}

	// Resolve per-channel permissions (applies guild-level permissions and channel-level role overrides)
	if s.permService != nil {
		permsMap, err := s.permService.ResolveBatchChannelPermissions(ctx, guildID, userID, channelIDs)
		if err != nil {
			return nil, errors.NewForbidden("access denied: not a member of the guild")
		}

		// Enrich channels with resolved permission bitmask AND filter out
		// channels where the user's final VIEW_CHANNEL bit is unset.
		var visible []Channel
		for i, ch := range channels {
			perm, ok := permsMap[ch.ID]
			if !ok {
				continue
			}
			channels[i].Permissions = fmt.Sprintf("%d", perm)
			if permissions.HasPermission(perm, permissions.VIEW_CHANNEL) {
				visible = append(visible, channels[i])
			}
		}
		return visible, nil
	}

	// Fallback if permService is nil
	allowed, err := s.checkPermissions(ctx, guildID, userID, permissions.VIEW_CHANNEL)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, errors.NewForbidden("access denied: view channel permission required")
	}
	return channels, nil
}

func (s *service) CreateChannel(ctx context.Context, guildID, userID int64, req *CreateChannelRequest) (*Channel, error) {
	// Verify user is member and has MANAGE_CHANNELS permission
	allowed, err := s.checkPermissions(ctx, guildID, userID, permissions.MANAGE_CHANNELS)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, errors.NewForbidden("insufficient permissions to create channels")
	}

	// If parent channel is provided, verify it exists and is a category type
	if req.ParentChannelID != nil {
		parent, err := s.repo.GetByID(ctx, *req.ParentChannelID)
		if err != nil {
			return nil, err
		}
		if parent == nil || parent.Type != 2 { // Parent must be Category
			return nil, errors.NewBadRequest("invalid parent category ID")
		}
	}

	// Get current maximum position to set the new channel to the bottom
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

	payload, _ := json.Marshal(struct {
		*Channel
		IsRestricted bool `json:"is_restricted"`
	}{
		Channel:      ch,
		IsRestricted: false,
	})
	event := &OutboxEvent{
		AggregateType: "guild",
		AggregateID:   guildID,
		EventType:     events.ChannelCreate,
		Payload:       payload,
		PartitionKey:  int16(guildID % 16),
	}

	if err := s.repo.Create(ctx, ch, event); err != nil {
		return nil, err
	}

	if s.auditService != nil {
		_ = s.auditService.NewEntry().
			Guild(guildID).
			ActorID(ctx, userID).
			Action(audit.ActionChannelCreate).
			TargetResource(audit.TargetChannel, &ch.ID, fmt.Sprintf("#%s", ch.Name)).
			Log(ctx)
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

	// Verify user is member and has MANAGE_CHANNELS permission
	allowed, err := s.checkPermissions(ctx, *ch.GuildID, userID, permissions.MANAGE_CHANNELS)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, errors.NewForbidden("insufficient permissions to manage channels")
	}

	oldName := ch.Name
	oldTopic := ch.Topic
	oldPos := ch.Position

	// If parent channel is provided, verify it exists and is a category type
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

	payload, _ := json.Marshal(ch)
	event := &OutboxEvent{
		AggregateType: "guild",
		AggregateID:   *ch.GuildID,
		EventType:     events.ChannelUpdate,
		Payload:       payload,
		PartitionKey:  int16(*ch.GuildID % 16),
	}

	// Update channel - db increments version
	if err := s.repo.Update(ctx, ch, event); err != nil {
		return nil, err
	}

	if s.auditService != nil {
		changes := audit.NewChanges().
			Add("name", oldName, ch.Name).
			AddPtr("topic", oldTopic, ch.Topic).
			Add("position", oldPos, ch.Position).
			Build()
		if changes != nil {
			action := audit.ActionChannelUpdate
			if oldPos != ch.Position {
				action = audit.ActionChannelMove
			}
			_ = s.auditService.NewEntry().
				Guild(*ch.GuildID).
				ActorID(ctx, userID).
				Action(action).
				TargetResource(audit.TargetChannel, &ch.ID, fmt.Sprintf("#%s", ch.Name)).
				Changes(changes).
				Log(ctx)
		}
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

	// Verify user is member and has MANAGE_CHANNELS permission
	allowed, err := s.checkPermissions(ctx, *ch.GuildID, userID, permissions.MANAGE_CHANNELS)
	if err != nil {
		return err
	}
	if !allowed {
		return errors.NewForbidden("insufficient permissions to manage channels")
	}

	payload, _ := json.Marshal(map[string]any{
		"id":       strconv.FormatInt(channelID, 10),
		"guild_id": strconv.FormatInt(*ch.GuildID, 10),
	})
	event := &OutboxEvent{
		AggregateType: "guild",
		AggregateID:   *ch.GuildID,
		EventType:     events.ChannelDelete,
		Payload:       payload,
		PartitionKey:  int16(*ch.GuildID % 16),
	}

	// Soft delete channel
	if err := s.repo.SoftDelete(ctx, channelID, event); err != nil {
		return err
	}

	if s.auditService != nil {
		_ = s.auditService.NewEntry().
			Guild(*ch.GuildID).
			ActorID(ctx, userID).
			Action(audit.ActionChannelDelete).
			TargetResource(audit.TargetChannel, &channelID, fmt.Sprintf("#%s", ch.Name)).
			Log(ctx)
	}

	return nil
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
		return ch, nil
	}

	// Resolve and enrich channel permissions for the user
	if s.permService != nil {
		perm, err := s.permService.ResolveChannelPermissions(ctx, *ch.GuildID, ch.ID, userID)
		if err != nil {
			return nil, errors.NewForbidden("access denied: not a member of the guild")
		}
		if !permissions.HasPermission(perm, permissions.VIEW_CHANNEL) {
			return nil, errors.NewForbidden("access denied: view channel permission required")
		}
		ch.Permissions = fmt.Sprintf("%d", perm)
	} else {
		allowed, err := s.checkPermissions(ctx, *ch.GuildID, userID, permissions.VIEW_CHANNEL)
		if err != nil {
			return nil, err
		}
		if !allowed {
			return nil, errors.NewForbidden("access denied: view channel permission required")
		}
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

	// Verify user has MANAGE_ROLES or MANAGE_CHANNELS permission
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

	// Get role overrides for channel
	list, err := s.repo.GetRoleOverrides(ctx, channelID)
	if err != nil {
		return nil, err
	}

	// Convert permissions to strings
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

	// Verify user has MANAGE_ROLES or MANAGE_CHANNELS permission via ResolveChannelPermissions
	if s.permService != nil {
		userPerms, err := s.permService.ResolveChannelPermissions(ctx, *ch.GuildID, channelID, userID)
		if err != nil {
			return err
		}
		if !permissions.HasAnyPermission(permissions.Permission(userPerms), permissions.MANAGE_ROLES, permissions.MANAGE_CHANNELS) {
			return errors.NewForbidden("insufficient permissions to manage channel overrides")
		}
	} else {
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
	}

	// Convert permissions to integers
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

	// Upsert override
	if err := s.repo.PutRoleOverride(ctx, override, *ch.GuildID); err != nil {
		return err
	}

	if s.auditService != nil {
		_ = s.auditService.NewEntry().
			Guild(*ch.GuildID).
			ActorID(ctx, userID).
			Action(audit.ActionChannelPermissionUpdate).
			TargetResource(audit.TargetChannel, &channelID, fmt.Sprintf("#%s", ch.Name)).
			Metadata("role_id", strconv.FormatInt(roleID, 10)).
			Metadata("allow_permissions", req.AllowPermissions).
			Metadata("deny_permissions", req.DenyPermissions).
			Log(ctx)
	}

	return nil
}

func (s *service) DeleteRoleOverride(ctx context.Context, channelID, userID, roleID int64) error {
	ch, err := s.repo.GetByID(ctx, channelID)
	if err != nil {
		return err
	}
	if ch == nil || ch.GuildID == nil {
		return errors.NewNotFound("channel not found")
	}

	// Verify user has MANAGE_ROLES or MANAGE_CHANNELS permission via ResolveChannelPermissions
	if s.permService != nil {
		userPerms, err := s.permService.ResolveChannelPermissions(ctx, *ch.GuildID, channelID, userID)
		if err != nil {
			return err
		}
		if !permissions.HasAnyPermission(permissions.Permission(userPerms), permissions.MANAGE_ROLES, permissions.MANAGE_CHANNELS) {
			return errors.NewForbidden("insufficient permissions to manage channel overrides")
		}
	} else {
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
	}

	// Delete override
	if err := s.repo.DeleteRoleOverride(ctx, channelID, roleID, *ch.GuildID); err != nil {
		return err
	}

	if s.auditService != nil {
		_ = s.auditService.NewEntry().
			Guild(*ch.GuildID).
			ActorID(ctx, userID).
			Action(audit.ActionChannelPermissionDelete).
			TargetResource(audit.TargetChannel, &channelID, fmt.Sprintf("#%s", ch.Name)).
			Metadata("role_id", strconv.FormatInt(roleID, 10)).
			Log(ctx)
	}

	return nil
}
