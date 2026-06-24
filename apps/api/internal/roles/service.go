package roles

import (
	"context"

	"github.com/synapse/api/internal/errors"
	"github.com/synapse/api/internal/permissions"
	"github.com/synapse/api/internal/snowflake"
)

type Service interface {
	GetRoles(ctx context.Context, guildID, userID int64) ([]Role, error)
	CreateRole(ctx context.Context, guildID, userID int64, req *CreateRoleRequest) (*Role, error)
	UpdateRole(ctx context.Context, guildID, roleID, userID int64, req *UpdateRoleRequest) (*Role, error)
	DeleteRole(ctx context.Context, guildID, roleID, userID int64) error
	AssignRole(ctx context.Context, guildID, targetUserID, roleID, requesterUserID int64) error
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) checkPermissions(ctx context.Context, guildID, userID int64, perm int64) (bool, error) {
	ownerID, err := s.repo.GetGuildOwner(ctx, guildID)
	if err != nil {
		return false, err
	}
	if ownerID == userID {
		return true, nil
	}

	rlist, err := s.repo.GetMemberRoles(ctx, guildID, userID)
	if err != nil {
		return false, err
	}

	var combined int64
	for _, rl := range rlist {
		combined |= rl.Permissions
	}

	return permissions.HasPermission(combined, perm), nil
}

func (s *service) GetRoles(ctx context.Context, guildID, userID int64) ([]Role, error) {
	// Any member can read roles in their guild. Check if user is member by trying to list roles or fetching user roles.
	// To keep it simple and robust, let's verify memberships
	rlist, err := s.repo.GetMemberRoles(ctx, guildID, userID)
	if err != nil {
		return nil, errors.NewForbidden("not a member of the guild")
	}
	if len(rlist) == 0 {
		return nil, errors.NewForbidden("not a member of the guild")
	}

	return s.repo.ListRoles(ctx, guildID)
}

func (s *service) CreateRole(ctx context.Context, guildID, userID int64, req *CreateRoleRequest) (*Role, error) {
	allowed, err := s.checkPermissions(ctx, guildID, userID, permissions.MANAGE_ROLES)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, errors.NewForbidden("insufficient permissions to manage roles")
	}

	maxPos, err := s.repo.GetMaxPosition(ctx, guildID)
	if err != nil {
		return nil, err
	}

	var perms int64
	if req.Permissions != nil {
		perms = *req.Permissions
	}

	rl := &Role{
		ID:          snowflake.GenerateID(),
		GuildID:     guildID,
		Name:        req.Name,
		Color:       req.Color,
		Position:    maxPos + 1,
		Permissions: perms,
		IsDefault:   false,
		Version:     1,
	}

	if err := s.repo.Create(ctx, rl); err != nil {
		return nil, err
	}

	return rl, nil
}

func (s *service) UpdateRole(ctx context.Context, guildID, roleID, userID int64, req *UpdateRoleRequest) (*Role, error) {
	allowed, err := s.checkPermissions(ctx, guildID, userID, permissions.MANAGE_ROLES)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, errors.NewForbidden("insufficient permissions to manage roles")
	}

	rl, err := s.repo.GetByID(ctx, roleID)
	if err != nil {
		return nil, err
	}
	if rl == nil || rl.GuildID != guildID {
		return nil, errors.NewNotFound("role not found")
	}

	if rl.IsDefault && req.Position != nil {
		return nil, errors.NewBadRequest("cannot change position of default @everyone role")
	}

	if req.Name != nil {
		rl.Name = *req.Name
	}
	if req.Color != nil {
		rl.Color = req.Color
	}
	if req.Permissions != nil {
		rl.Permissions = *req.Permissions
	}
	if req.Position != nil {
		rl.Position = *req.Position
	}

	if err := s.repo.Update(ctx, rl); err != nil {
		return nil, err
	}

	return rl, nil
}

func (s *service) DeleteRole(ctx context.Context, guildID, roleID, userID int64) error {
	allowed, err := s.checkPermissions(ctx, guildID, userID, permissions.MANAGE_ROLES)
	if err != nil {
		return err
	}
	if !allowed {
		return errors.NewForbidden("insufficient permissions to manage roles")
	}

	rl, err := s.repo.GetByID(ctx, roleID)
	if err != nil {
		return err
	}
	if rl == nil || rl.GuildID != guildID {
		return errors.NewNotFound("role not found")
	}

	if rl.IsDefault {
		return errors.NewBadRequest("cannot delete default @everyone role")
	}

	return s.repo.Delete(ctx, roleID)
}

func (s *service) AssignRole(ctx context.Context, guildID, targetUserID, roleID, requesterUserID int64) error {
	allowed, err := s.checkPermissions(ctx, guildID, requesterUserID, permissions.MANAGE_ROLES)
	if err != nil {
		return err
	}
	if !allowed {
		return errors.NewForbidden("insufficient permissions to manage roles")
	}

	rl, err := s.repo.GetByID(ctx, roleID)
	if err != nil {
		return err
	}
	if rl == nil || rl.GuildID != guildID {
		return errors.NewNotFound("role not found")
	}

	// Verify requester's highest role position is greater than the assigned role position
	// Owner is bypassed.
	ownerID, err := s.repo.GetGuildOwner(ctx, guildID)
	if err != nil {
		return err
	}

	if requesterUserID != ownerID {
		requesterRoles, err := s.repo.GetMemberRoles(ctx, guildID, requesterUserID)
		if err != nil {
			return err
		}
		var maxReqPos int = -1
		for _, r := range requesterRoles {
			if r.Position > maxReqPos {
				maxReqPos = r.Position
			}
		}
		if maxReqPos <= rl.Position {
			return errors.NewForbidden("cannot assign a role higher or equal to your own highest role")
		}
	}

	return s.repo.AddMemberRole(ctx, guildID, targetUserID, roleID)
}
