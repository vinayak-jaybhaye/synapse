package invites

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"math/big"
	"strconv"
	"time"

	"github.com/synapse/api/internal/audit"
	"github.com/synapse/api/internal/errors"
	"github.com/synapse/api/internal/events"
	"github.com/synapse/api/internal/permissions"
	"github.com/synapse/api/internal/roles"
	"github.com/synapse/api/internal/snowflake"
)

type Service interface {
	CreateInvite(ctx context.Context, guildID, userID int64, req *CreateInviteRequest) (*Invite, error)
	GetInvite(ctx context.Context, code string) (*InviteMetadata, error)
	GetGuildInvites(ctx context.Context, guildID, userID int64) ([]Invite, error)
	DeleteInvite(ctx context.Context, code string, userID int64) error
	JoinGuild(ctx context.Context, code string, userID int64) error
}

type service struct {
	repo         Repository
	roleRepo     roles.Repository
	auditService audit.Service
}

func NewService(repo Repository, roleRepo roles.Repository, auditService audit.Service) Service {
	return &service{repo: repo, roleRepo: roleRepo, auditService: auditService}
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

func generateRandomCode(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	ret := make([]byte, n)
	for i := 0; i < n; i++ {
		num, _ := rand.Int(rand.Reader, big.NewInt(int64(len(letters))))
		ret[i] = letters[num.Int64()]
	}
	return string(ret)
}

func (s *service) CreateInvite(ctx context.Context, guildID, userID int64, req *CreateInviteRequest) (*Invite, error) {
	// Verify user is member and has CREATE_INSTANT_INVITE permission
	allowed, err := s.checkPermissions(ctx, guildID, userID, permissions.CREATE_INSTANT_INVITE)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, errors.NewForbidden("insufficient permissions to create invites")
	}

	var expiresAt *time.Time
	if req.Duration > 0 {
		exp := time.Now().Add(time.Duration(req.Duration) * time.Second)
		expiresAt = &exp
	}

	code := generateRandomCode(8)

	invite := &Invite{
		ID:        snowflake.GenerateID(),
		GuildID:   guildID,
		CreatedBy: userID,
		Code:      code,
		ExpiresAt: expiresAt,
		MaxUses:   req.MaxUses,
		Uses:      0,
		CreatedAt: time.Now(),
	}

	if err := s.repo.Create(ctx, invite); err != nil {
		return nil, err
	}

	if s.auditService != nil {
		_ = s.auditService.NewEntry().
			Guild(guildID).
			ActorID(ctx, userID).
			Action(audit.ActionInviteCreate).
			TargetResource(audit.TargetInvite, &invite.ID, fmt.Sprintf("Invite %s", code)).
			Metadata("code", code).
			Metadata("max_uses", req.MaxUses).
			Metadata("duration", req.Duration).
			Log(ctx)
	}

	return invite, nil
}

func (s *service) GetGuildInvites(ctx context.Context, guildID, userID int64) ([]Invite, error) {
	// Verify permission (MANAGE_GUILD or CREATE_INSTANT_INVITE)
	allowed, err := s.checkPermissions(ctx, guildID, userID, permissions.MANAGE_GUILD)
	if err != nil {
		return nil, err
	}
	if !allowed {
		allowed, err = s.checkPermissions(ctx, guildID, userID, permissions.CREATE_INSTANT_INVITE)
		if err != nil {
			return nil, err
		}
		if !allowed {
			return nil, errors.NewForbidden("insufficient permissions to view invites")
		}
	}

	return s.repo.ListGuildInvites(ctx, guildID)
}

func (s *service) DeleteInvite(ctx context.Context, code string, userID int64) error {
	invite, err := s.repo.GetByCode(ctx, code)
	if err != nil {
		return err
	}
	if invite == nil {
		return errors.NewNotFound("invite code not found")
	}

	// Requester must be invite creator or have MANAGE_GUILD permission
	if invite.CreatedBy != userID {
		allowed, err := s.checkPermissions(ctx, invite.GuildID, userID, permissions.MANAGE_GUILD)
		if err != nil {
			return err
		}
		if !allowed {
			return errors.NewForbidden("insufficient permissions to delete invite")
		}
	}

	if err := s.repo.Delete(ctx, code); err != nil {
		return err
	}

	if s.auditService != nil {
		_ = s.auditService.NewEntry().
			Guild(invite.GuildID).
			ActorID(ctx, userID).
			Action(audit.ActionInviteDelete).
			TargetResource(audit.TargetInvite, &invite.ID, fmt.Sprintf("Invite %s", code)).
			Metadata("code", code).
			Log(ctx)
	}

	return nil
}

func (s *service) GetInvite(ctx context.Context, code string) (*InviteMetadata, error) {
	meta, err := s.repo.GetInviteMetadata(ctx, code)
	if err != nil {
		return nil, err
	}
	if meta == nil {
		return nil, errors.NewNotFound("invite code not found")
	}

	// Double-check expiration
	invite, err := s.repo.GetByCode(ctx, code)
	if err != nil {
		return nil, err
	}
	if invite != nil {
		if invite.ExpiresAt != nil && invite.ExpiresAt.Before(time.Now()) {
			return nil, errors.NewNotFound("invite has expired")
		}
		if invite.MaxUses > 0 && invite.Uses >= invite.MaxUses {
			return nil, errors.NewNotFound("invite usage limit reached")
		}
	}

	return meta, nil
}

func (s *service) JoinGuild(ctx context.Context, code string, userID int64) error {
	invite, err := s.repo.GetByCode(ctx, code)
	if err != nil {
		return err
	}
	if invite == nil {
		return errors.NewNotFound("invite code not found")
	}

	// 1. Check expiration
	if invite.ExpiresAt != nil && invite.ExpiresAt.Before(time.Now()) {
		return errors.NewBadRequest("invite has expired")
	}

	// 2. Check uses limit
	if invite.MaxUses > 0 && invite.Uses >= invite.MaxUses {
		return errors.NewBadRequest("invite has reached maximum uses")
	}

	// 3. Check if user is already a member of the guild
	isMem, err := s.repo.IsMember(ctx, invite.GuildID, userID)
	if err != nil {
		return err
	}
	if isMem {
		return errors.NewConflict("already a member of this guild")
	}

	// 4. Check if user is banned
	isBanned, err := s.repo.IsBanned(ctx, invite.GuildID, userID)
	if err != nil {
		return err
	}
	if isBanned {
		return errors.NewForbidden("access denied: you are banned from this server")
	}

	payload, _ := json.Marshal(map[string]any{
		"guild_id": strconv.FormatInt(invite.GuildID, 10),
		"user_id":  strconv.FormatInt(userID, 10),
	})
	event := &OutboxEvent{
		AggregateType: "guild",
		AggregateID:   invite.GuildID,
		EventType:     events.GuildMemberAdd,
		Payload:       payload,
		PartitionKey:  int16(invite.GuildID % 16),
	}

	// 5. Consume invite and join guild
	if err := s.repo.JoinGuildTx(ctx, code, invite.GuildID, userID, event); err != nil {
		return err
	}

	if s.auditService != nil {
		_ = s.auditService.NewEntry().
			Guild(invite.GuildID).
			ActorID(ctx, userID).
			Action(audit.ActionMemberAdd).
			TargetResource(audit.TargetUser, &userID, fmt.Sprintf("User %d", userID)).
			Metadata("code", code).
			Log(ctx)
	}

	return nil
}
