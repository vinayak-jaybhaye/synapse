package invites

import (
	"context"
	"crypto/rand"
	"math/big"
	"time"

	"github.com/synapse/api/internal/errors"
	"github.com/synapse/api/internal/permissions"
	"github.com/synapse/api/internal/roles"
	"github.com/synapse/api/internal/snowflake"
)

type Service interface {
	CreateInvite(ctx context.Context, guildID, userID int64, req *CreateInviteRequest) (*Invite, error)
	GetInvite(ctx context.Context, code string) (*InviteMetadata, error)
	JoinGuild(ctx context.Context, code string, userID int64) error
}

type service struct {
	repo     Repository
	roleRepo roles.Repository
}

func NewService(repo Repository, roleRepo roles.Repository) Service {
	return &service{repo: repo, roleRepo: roleRepo}
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

	return invite, nil
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

	// 5. Consume invite and join guild
	return s.repo.JoinGuildTx(ctx, code, invite.GuildID, userID)
}
