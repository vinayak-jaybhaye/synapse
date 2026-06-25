package guilds

import (
	"context"
	"time"

	"github.com/synapse/api/internal/errors"
	"github.com/synapse/api/internal/media"
	"github.com/synapse/api/internal/permissions"
	"github.com/synapse/api/internal/roles"
	"github.com/synapse/api/internal/snowflake"
)

type Service interface {
	CreateGuild(ctx context.Context, ownerID int64, req *CreateGuildRequest) (*Guild, error)
	GetGuild(ctx context.Context, guildID, userID int64) (*Guild, error)
	GetGuildMembers(ctx context.Context, guildID, userID, afterUserID int64, limit int) ([]MemberWithUser, error)
	UpdateGuildMember(ctx context.Context, guildID, targetUserID, requesterUserID int64, req *UpdateMemberRequest) (*GuildMember, error)
	GenerateIconUploadURL(ctx context.Context, guildID, userID int64, req *media.UploadRequest) (*media.UploadResponse, error)
	GenerateBannerUploadURL(ctx context.Context, guildID, userID int64, req *media.UploadRequest) (*media.UploadResponse, error)
	UpdateGuild(ctx context.Context, guildID, userID int64, req *UpdateGuildRequest) (*Guild, error)
}

type service struct {
	repo         Repository
	roleRepo     roles.Repository
	mediaService media.Service
}

func NewService(repo Repository, roleRepo roles.Repository, mediaService media.Service) Service {
	return &service{repo: repo, roleRepo: roleRepo, mediaService: mediaService}
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

func (s *service) CreateGuild(ctx context.Context, ownerID int64, req *CreateGuildRequest) (*Guild, error) {
	g := &Guild{
		ID:          snowflake.GenerateID(),
		OwnerID:     ownerID,
		Name:        req.Name,
		Description: req.Description,
		IconKey:     nil,
		Version:     1,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.repo.CreateGuildTx(ctx, g); err != nil {
		return nil, err
	}

	return g, nil
}

func (s *service) GetGuild(ctx context.Context, guildID, userID int64) (*Guild, error) {
	// Verify user is a member of this guild
	member, err := s.repo.GetMember(ctx, guildID, userID)
	if err != nil {
		return nil, err
	}
	if member == nil {
		return nil, errors.NewForbidden("access denied: not a member of this guild")
	}

	g, err := s.repo.GetByID(ctx, guildID)
	if err != nil {
		return nil, err
	}
	if g == nil {
		return nil, errors.NewNotFound("guild not found")
	}

	return g, nil
}

func (s *service) GetGuildMembers(ctx context.Context, guildID, userID, afterUserID int64, limit int) ([]MemberWithUser, error) {
	// Verify requester is a member of this guild
	member, err := s.repo.GetMember(ctx, guildID, userID)
	if err != nil {
		return nil, err
	}
	if member == nil {
		return nil, errors.NewForbidden("access denied: not a member of this guild")
	}

	if limit <= 0 || limit > 100 {
		limit = 50
	}

	return s.repo.ListMembersCursor(ctx, guildID, afterUserID, limit)
}

func (s *service) UpdateGuildMember(ctx context.Context, guildID, targetUserID, requesterUserID int64, req *UpdateMemberRequest) (*GuildMember, error) {
	// Verify target member exists
	m, err := s.repo.GetMember(ctx, guildID, targetUserID)
	if err != nil {
		return nil, err
	}
	if m == nil {
		return nil, errors.NewNotFound("member not found")
	}

	// 1. Nickname modification permission check
	if req.Nickname != nil {
		if requesterUserID == targetUserID {
			// Changing own nickname requires CHANGE_NICKNAME or MANAGE_NICKNAMES
			allowed, err := s.checkPermissions(ctx, guildID, requesterUserID, permissions.CHANGE_NICKNAME)
			if err != nil {
				return nil, err
			}
			if !allowed {
				// Also try MANAGE_NICKNAMES
				allowed, err = s.checkPermissions(ctx, guildID, requesterUserID, permissions.MANAGE_NICKNAMES)
				if err != nil {
					return nil, err
				}
				if !allowed {
					return nil, errors.NewForbidden("insufficient permissions to change own nickname")
				}
			}
		} else {
			// Changing other member's nickname requires MANAGE_NICKNAMES
			allowed, err := s.checkPermissions(ctx, guildID, requesterUserID, permissions.MANAGE_NICKNAMES)
			if err != nil {
				return nil, err
			}
			if !allowed {
				return nil, errors.NewForbidden("insufficient permissions to change member nickname")
			}
		}
		m.Nickname = req.Nickname
	}

	// 2. Mute status modification permission check
	if req.IsMuted != nil {
		allowed, err := s.checkPermissions(ctx, guildID, requesterUserID, permissions.MUTE_MEMBERS)
		if err != nil {
			return nil, err
		}
		if !allowed {
			return nil, errors.NewForbidden("insufficient permissions to mute members")
		}
		m.IsMuted = *req.IsMuted
	}

	if err := s.repo.UpdateMember(ctx, m); err != nil {
		return nil, err
	}

	return m, nil
}

func (s *service) GenerateIconUploadURL(ctx context.Context, guildID, userID int64, req *media.UploadRequest) (*media.UploadResponse, error) {
	allowed, err := s.checkPermissions(ctx, guildID, userID, permissions.MANAGE_GUILD)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, errors.NewForbidden("insufficient permissions to manage guild icon")
	}

	req.Category = media.CategoryGuildIcon
	return s.mediaService.GenerateUploadURL(ctx, userID, guildID, req)
}

func (s *service) GenerateBannerUploadURL(ctx context.Context, guildID, userID int64, req *media.UploadRequest) (*media.UploadResponse, error) {
	allowed, err := s.checkPermissions(ctx, guildID, userID, permissions.MANAGE_GUILD)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, errors.NewForbidden("insufficient permissions to manage guild banner")
	}

	req.Category = media.CategoryBanner
	return s.mediaService.GenerateUploadURL(ctx, userID, guildID, req)
}

func (s *service) UpdateGuild(ctx context.Context, guildID, userID int64, req *UpdateGuildRequest) (*Guild, error) {
	rlist, err := s.roleRepo.GetMemberRoles(ctx, guildID, userID)
	if err != nil { return nil, err }
	
	var combined permissions.Permission
	for _, rl := range rlist {
		combined |= permissions.Permission(rl.Permissions)
	}
	ownerID, err := s.roleRepo.GetGuildOwner(ctx, guildID)
	if err != nil { return nil, err }
	
	if ownerID != userID && !permissions.HasPermission(combined, permissions.MANAGE_GUILD) {
		return nil, errors.NewForbidden("insufficient permissions to manage guild")
	}

	g, err := s.repo.GetByID(ctx, guildID)
	if err != nil { return nil, err }
	if g == nil { return nil, errors.NewNotFound("guild not found") }

	if req.Name != nil {
		g.Name = *req.Name
	}
	if req.Description != nil {
		if *req.Description == "" {
			g.Description = nil
		} else {
			g.Description = req.Description
		}
	}

	if req.RemoveIcon != nil && *req.RemoveIcon {
		g.IconKey = nil
	} else if req.IconUploadID != nil {
		upload, err := s.mediaService.MarkUploadComplete(ctx, *req.IconUploadID, userID)
		if err != nil { return nil, err }
		g.IconKey = &upload.ObjectKey
	}

	if req.RemoveBanner != nil && *req.RemoveBanner {
		g.BannerKey = nil
	} else if req.BannerUploadID != nil {
		upload, err := s.mediaService.MarkUploadComplete(ctx, *req.BannerUploadID, userID)
		if err != nil { return nil, err }
		g.BannerKey = &upload.ObjectKey
	}

	err = s.repo.UpdateGuild(ctx, g)
	if err != nil { return nil, err }
	return g, nil
}
