package guilds

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
	CreateGuild(ctx context.Context, ownerID int64, req *CreateGuildRequest) (*Guild, error)
	GetGuild(ctx context.Context, guildID, userID int64) (*Guild, error)
	GetGuildMembers(ctx context.Context, guildID, userID, afterUserID int64, limit int) ([]MemberWithUser, error)
	UpdateGuildMember(ctx context.Context, guildID, targetUserID, requesterUserID int64, req *UpdateMemberRequest) (*GuildMember, error)
	GenerateIconUploadURL(ctx context.Context, guildID, userID int64, req *media.UploadRequest) (*media.UploadResponse, error)
	GenerateBannerUploadURL(ctx context.Context, guildID, userID int64, req *media.UploadRequest) (*media.UploadResponse, error)
	UpdateGuild(ctx context.Context, guildID, userID int64, req *UpdateGuildRequest) (*Guild, error)
	KickMember(ctx context.Context, guildID, targetUserID, requesterUserID int64) error
	BanMember(ctx context.Context, guildID, targetUserID, requesterUserID int64, reason string) error
	GetBans(ctx context.Context, guildID, userID int64) ([]BanWithUser, error)
	UnbanMember(ctx context.Context, guildID, targetUserID, requesterUserID int64) error
}

type service struct {
	repo         Repository
	roleRepo     roles.Repository
	mediaService media.Service
	auditService audit.Service
}

func NewService(repo Repository, roleRepo roles.Repository, mediaService media.Service, auditService audit.Service) Service {
	return &service{repo: repo, roleRepo: roleRepo, mediaService: mediaService, auditService: auditService}
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

	oldNick := m.Nickname

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

	payload, _ := json.Marshal(m)
	event := &OutboxEvent{
		AggregateType: "guild",
		AggregateID:   guildID,
		EventType:     events.GuildMemberUpdate,
		Payload:       payload,
		PartitionKey:  int16(guildID % 16),
	}

	if err := s.repo.UpdateMember(ctx, m, event); err != nil {
		return nil, err
	}

	if s.auditService != nil && req.Nickname != nil {
		changes := audit.NewChanges().AddPtr("nickname", oldNick, m.Nickname).Build()
		if changes != nil {
			_ = s.auditService.NewEntry().
				Guild(guildID).
				ActorID(ctx, requesterUserID).
				Action(audit.ActionMemberNickUpdate).
				TargetResource(audit.TargetMember, &targetUserID, fmt.Sprintf("User %d", targetUserID)).
				Changes(changes).
				Log(ctx)
		}
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
	if err != nil {
		return nil, err
	}

	var combined permissions.Permission
	for _, rl := range rlist {
		combined |= permissions.Permission(rl.Permissions)
	}
	ownerID, err := s.roleRepo.GetGuildOwner(ctx, guildID)
	if err != nil {
		return nil, err
	}

	if ownerID != userID && !permissions.HasPermission(combined, permissions.MANAGE_GUILD) {
		return nil, errors.NewForbidden("insufficient permissions to manage guild")
	}

	g, err := s.repo.GetByID(ctx, guildID)
	if err != nil {
		return nil, err
	}
	if g == nil {
		return nil, errors.NewNotFound("guild not found")
	}

	oldName := g.Name
	oldDesc := g.Description
	oldIcon := g.IconKey
	oldBanner := g.BannerKey

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

	var keysToDelete []string

	if req.RemoveIcon != nil && *req.RemoveIcon {
		if g.IconKey != nil && *g.IconKey != "" {
			keysToDelete = append(keysToDelete, *g.IconKey)
		}
		g.IconKey = nil
	} else if req.IconUploadID != nil {
		if g.IconKey != nil && *g.IconKey != "" {
			keysToDelete = append(keysToDelete, *g.IconKey)
		}
		upload, err := s.mediaService.MarkUploadComplete(ctx, *req.IconUploadID, userID)
		if err != nil {
			return nil, err
		}
		g.IconKey = &upload.ObjectKey
	}

	if req.RemoveBanner != nil && *req.RemoveBanner {
		if g.BannerKey != nil && *g.BannerKey != "" {
			keysToDelete = append(keysToDelete, *g.BannerKey)
		}
		g.BannerKey = nil
	} else if req.BannerUploadID != nil {
		if g.BannerKey != nil && *g.BannerKey != "" {
			keysToDelete = append(keysToDelete, *g.BannerKey)
		}
		upload, err := s.mediaService.MarkUploadComplete(ctx, *req.BannerUploadID, userID)
		if err != nil {
			return nil, err
		}
		g.BannerKey = &upload.ObjectKey
	}

	payload, _ := json.Marshal(g)
	event := &OutboxEvent{
		AggregateType: "guild",
		AggregateID:   guildID,
		EventType:     events.GuildUpdate,
		Payload:       payload,
		PartitionKey:  int16(guildID % 16),
	}

	err = s.repo.UpdateGuild(ctx, g, event)
	if err != nil {
		return nil, err
	}

	if s.auditService != nil {
		changes := audit.NewChanges().
			Add("name", oldName, g.Name).
			AddPtr("description", oldDesc, g.Description).
			AddPtr("icon_key", oldIcon, g.IconKey).
			AddPtr("banner_key", oldBanner, g.BannerKey).
			Build()
		if changes != nil {
			_ = s.auditService.NewEntry().
				Guild(guildID).
				ActorID(ctx, userID).
				Action(audit.ActionGuildUpdate).
				TargetResource(audit.TargetGuild, &guildID, g.Name).
				Changes(changes).
				Log(ctx)
		}
	}

	// Clean up pending upload records as they are successfully saved/consumed
	if req.IconUploadID != nil {
		_ = s.mediaService.DeletePendingUpload(ctx, *req.IconUploadID)
	}
	if req.BannerUploadID != nil {
		_ = s.mediaService.DeletePendingUpload(ctx, *req.BannerUploadID)
	}

	// Async/best-effort clean up of old files in storage
	for _, key := range keysToDelete {
		_ = s.mediaService.DeleteObject(ctx, key)
	}

	return g, nil
}

func (s *service) compareRoleHierarchy(ctx context.Context, guildID, requesterUserID, targetUserID int64) (bool, error) {
	ownerID, err := s.roleRepo.GetGuildOwner(ctx, guildID)
	if err != nil {
		return false, err
	}

	// Owner can bypass hierarchy checks
	if requesterUserID == ownerID {
		return true, nil
	}

	// Owner can never be targeted
	if targetUserID == ownerID {
		return false, nil
	}

	// Fetch requester roles
	reqRoles, err := s.roleRepo.GetMemberRoles(ctx, guildID, requesterUserID)
	if err != nil {
		return false, err
	}

	// Fetch target roles
	targetRoles, err := s.roleRepo.GetMemberRoles(ctx, guildID, targetUserID)
	if err != nil {
		return false, err
	}

	var maxReqPos int = -1
	for _, r := range reqRoles {
		if r.Position > maxReqPos {
			maxReqPos = r.Position
		}
	}

	var maxTargetPos int = -1
	for _, r := range targetRoles {
		if r.Position > maxTargetPos {
			maxTargetPos = r.Position
		}
	}

	return maxReqPos > maxTargetPos, nil
}

func (s *service) KickMember(ctx context.Context, guildID, targetUserID, requesterUserID int64) error {
	if requesterUserID == targetUserID {
		return errors.NewBadRequest("cannot kick yourself")
	}

	// 1. Verify target exists in guild
	m, err := s.repo.GetMember(ctx, guildID, targetUserID)
	if err != nil {
		return err
	}
	if m == nil {
		return errors.NewNotFound("member not found")
	}

	// 2. Verify requester permission
	allowed, err := s.checkPermissions(ctx, guildID, requesterUserID, permissions.KICK_MEMBERS)
	if err != nil {
		return err
	}
	if !allowed {
		return errors.NewForbidden("insufficient permissions to kick members")
	}

	// 3. Verify role hierarchy
	hierarchyOk, err := s.compareRoleHierarchy(ctx, guildID, requesterUserID, targetUserID)
	if err != nil {
		return err
	}
	if !hierarchyOk {
		return errors.NewForbidden("cannot kick someone with equal or higher role hierarchy")
	}

	payload, _ := json.Marshal(map[string]any{
		"guild_id": strconv.FormatInt(guildID, 10),
		"user_id":  strconv.FormatInt(targetUserID, 10),
	})
	event := &OutboxEvent{
		AggregateType: "guild",
		AggregateID:   guildID,
		EventType:     events.GuildMemberRemove,
		Payload:       payload,
		PartitionKey:  int16(guildID % 16),
	}

	err = s.repo.RemoveMember(ctx, guildID, targetUserID, event)
	if err == nil && s.auditService != nil {
		_ = s.auditService.NewEntry().
			Guild(guildID).
			ActorID(ctx, requesterUserID).
			Action(audit.ActionMemberKick).
			TargetResource(audit.TargetUser, &targetUserID, fmt.Sprintf("User %d", targetUserID)).
			Log(ctx)
	}
	return err
}

func (s *service) BanMember(ctx context.Context, guildID, targetUserID, requesterUserID int64, reason string) error {
	if requesterUserID == targetUserID {
		return errors.NewBadRequest("cannot ban yourself")
	}

	// 1. Verify target exists in guild
	m, err := s.repo.GetMember(ctx, guildID, targetUserID)
	if err != nil {
		return err
	}
	if m == nil {
		return errors.NewNotFound("member not found")
	}

	// 2. Verify requester permission
	allowed, err := s.checkPermissions(ctx, guildID, requesterUserID, permissions.BAN_MEMBERS)
	if err != nil {
		return err
	}
	if !allowed {
		return errors.NewForbidden("insufficient permissions to ban members")
	}

	// 3. Verify role hierarchy
	hierarchyOk, err := s.compareRoleHierarchy(ctx, guildID, requesterUserID, targetUserID)
	if err != nil {
		return err
	}
	if !hierarchyOk {
		return errors.NewForbidden("cannot ban someone with equal or higher role hierarchy")
	}

	payload, _ := json.Marshal(map[string]any{
		"guild_id": strconv.FormatInt(guildID, 10),
		"user_id":  strconv.FormatInt(targetUserID, 10),
	})
	event := &OutboxEvent{
		AggregateType: "guild",
		AggregateID:   guildID,
		EventType:     events.GuildBanAdd,
		Payload:       payload,
		PartitionKey:  int16(guildID % 16),
	}

	err = s.repo.BanMember(ctx, guildID, targetUserID, requesterUserID, reason, event)
	if err == nil && s.auditService != nil {
		_ = s.auditService.NewEntry().
			Guild(guildID).
			ActorID(ctx, requesterUserID).
			Action(audit.ActionMemberBan).
			TargetResource(audit.TargetUser, &targetUserID, fmt.Sprintf("User %d", targetUserID)).
			Reason(reason).
			Log(ctx)
	}
	return err
}

func (s *service) GetBans(ctx context.Context, guildID, userID int64) ([]BanWithUser, error) {
	// Requires BAN_MEMBERS permission
	allowed, err := s.checkPermissions(ctx, guildID, userID, permissions.BAN_MEMBERS)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, errors.NewForbidden("insufficient permissions to view bans")
	}

	return s.repo.ListBans(ctx, guildID)
}

func (s *service) UnbanMember(ctx context.Context, guildID, targetUserID, requesterUserID int64) error {
	// Requires BAN_MEMBERS permission
	allowed, err := s.checkPermissions(ctx, guildID, requesterUserID, permissions.BAN_MEMBERS)
	if err != nil {
		return err
	}
	if !allowed {
		return errors.NewForbidden("insufficient permissions to unban members")
	}

	err = s.repo.RemoveBan(ctx, guildID, targetUserID)
	if err == nil && s.auditService != nil {
		_ = s.auditService.NewEntry().
			Guild(guildID).
			ActorID(ctx, requesterUserID).
			Action(audit.ActionMemberUnban).
			TargetResource(audit.TargetUser, &targetUserID, fmt.Sprintf("User %d", targetUserID)).
			Log(ctx)
	}
	return err
}
