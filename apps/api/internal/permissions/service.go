package permissions

import (
	"context"
)

// RoleRepository defines the interface to interact with roles in the storage layer.
type RoleRepository interface {
	// GetMemberRoles retrieves all roles assigned to a user in a guild, including the default @everyone role.
	GetMemberRoles(ctx context.Context, guildID int64, userID int64) ([]Role, error)

	// IsMember checks if a user is a member of the guild.
	IsMember(ctx context.Context, guildID int64, userID int64) (bool, error)
}

// ChannelPermissionRepository defines the interface to interact with channel overrides in the storage layer.
type ChannelPermissionRepository interface {
	// GetRoleOverrides retrieves all role-specific permission overrides for a channel.
	GetRoleOverrides(ctx context.Context, channelID int64) ([]ChannelRolePermission, error)

	// GetChannelGuildID retrieves the guild ID of the channel, returning ErrChannelNotFound if not found.
	GetChannelGuildID(ctx context.Context, channelID int64) (int64, error)
}

// Service defines the interface for verifying user permissions at guild and channel levels.
type Service interface {
	// ResolveGuildPermissions aggregates all guild-level permissions for a user.
	ResolveGuildPermissions(ctx context.Context, guildID int64, userID int64) (Permission, error)

	// ResolveChannelPermissions calculates final channel permissions after applying overrides to guild permissions.
	ResolveChannelPermissions(ctx context.Context, guildID int64, channelID int64, userID int64) (Permission, error)

	// HasGuildPermission checks if a user has a specific guild-level permission.
	HasGuildPermission(ctx context.Context, guildID int64, userID int64, perm Permission) (bool, error)

	// HasChannelPermission checks if a user has a specific channel-level permission.
	HasChannelPermission(ctx context.Context, guildID int64, channelID int64, userID int64, perm Permission) (bool, error)
}

type permissionsService struct {
	roleRepo    RoleRepository
	channelRepo ChannelPermissionRepository
}

// NewService creates a new permissions Service with the given repository dependencies.
func NewService(roleRepo RoleRepository, channelRepo ChannelPermissionRepository) Service {
	return &permissionsService{
		roleRepo:    roleRepo,
		channelRepo: channelRepo,
	}
}

// ResolveGuildPermissions aggregates all roles assigned to the member and applies Administrator overrides.
func (s *permissionsService) ResolveGuildPermissions(ctx context.Context, guildID int64, userID int64) (Permission, error) {
	isMember, err := s.roleRepo.IsMember(ctx, guildID, userID)
	if err != nil {
		return 0, err
	}
	if !isMember {
		return 0, ErrMemberNotFound
	}

	roles, err := s.roleRepo.GetMemberRoles(ctx, guildID, userID)
	if err != nil {
		return 0, err
	}

	var mask Permission
	for _, r := range roles {
		mask |= r.Permissions
	}

	if (mask & ADMINISTRATOR) == ADMINISTRATOR {
		for _, p := range allPermissions {
			mask |= p
		}
	}

	return mask, nil
}

// ResolveChannelPermissions calculates final channel permissions using base permissions and channel role overrides.
func (s *permissionsService) ResolveChannelPermissions(ctx context.Context, guildID int64, channelID int64, userID int64) (Permission, error) {
	chGuildID, err := s.channelRepo.GetChannelGuildID(ctx, channelID)
	if err != nil {
		return 0, ErrChannelNotFound
	}
	if chGuildID != guildID {
		return 0, ErrChannelNotFound
	}

	isMember, err := s.roleRepo.IsMember(ctx, guildID, userID)
	if err != nil {
		return 0, err
	}
	if !isMember {
		return 0, ErrMemberNotFound
	}

	memberRoles, err := s.roleRepo.GetMemberRoles(ctx, guildID, userID)
	if err != nil {
		return 0, err
	}

	var basePerms Permission
	for _, r := range memberRoles {
		basePerms |= r.Permissions
	}

	// Administrators bypass all channel overrides
	if (basePerms & ADMINISTRATOR) == ADMINISTRATOR {
		for _, p := range allPermissions {
			basePerms |= p
		}
		return basePerms, nil
	}

	overrides, err := s.channelRepo.GetRoleOverrides(ctx, channelID)
	if err != nil {
		return 0, err
	}

	hasRole := make(map[int64]bool)
	var defaultRoleID int64
	for _, r := range memberRoles {
		hasRole[r.ID] = true
		if r.IsDefault {
			defaultRoleID = r.ID
		}
	}

	// 1. Apply @everyone (default role) override first
	var everyoneAllow, everyoneDeny Permission
	for _, o := range overrides {
		if o.RoleID == defaultRoleID {
			everyoneAllow = o.AllowPermissions
			everyoneDeny = o.DenyPermissions
			break
		}
	}
	basePerms = ApplyChannelOverrides(basePerms, everyoneAllow, everyoneDeny)

	// 2. Accumulate and apply specific role overrides
	var rolesAllow, rolesDeny Permission
	for _, o := range overrides {
		if o.RoleID != defaultRoleID && hasRole[o.RoleID] {
			rolesAllow |= o.AllowPermissions
			rolesDeny |= o.DenyPermissions
		}
	}
	basePerms = ApplyChannelOverrides(basePerms, rolesAllow, rolesDeny)

	return basePerms, nil
}

// HasGuildPermission checks if a user has a specific guild-level permission.
func (s *permissionsService) HasGuildPermission(ctx context.Context, guildID int64, userID int64, perm Permission) (bool, error) {
	mask, err := s.ResolveGuildPermissions(ctx, guildID, userID)
	if err != nil {
		return false, err
	}
	return HasPermission(mask, perm), nil
}

// HasChannelPermission checks if a user has a specific channel-level permission.
func (s *permissionsService) HasChannelPermission(ctx context.Context, guildID int64, channelID int64, userID int64, perm Permission) (bool, error) {
	mask, err := s.ResolveChannelPermissions(ctx, guildID, channelID, userID)
	if err != nil {
		return false, err
	}
	return HasPermission(mask, perm), nil
}
