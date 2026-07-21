package audit

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/synapse/api/internal/errors"
	"github.com/synapse/api/internal/permissions"
	"github.com/synapse/api/internal/snowflake"
	"github.com/synapse/api/internal/users"
)

type UserFetcher interface {
	GetByID(ctx context.Context, id int64) (*users.User, error)
}

type Service interface {
	Log(ctx context.Context, params LogParams) error
	NewEntry() *EntryBuilder
	GetActorSnapshot(ctx context.Context, actorID int64) ActorSnapshot
	ListGuildLogs(ctx context.Context, guildID, userID int64, filter AuditLogFilter) ([]AuditLogResponse, error)
}

type service struct {
	repo        Repository
	userRepo    UserFetcher
	permService permissions.Service
}

func NewService(repo Repository, userRepo UserFetcher, permService permissions.Service) Service {
	return &service{
		repo:        repo,
		userRepo:    userRepo,
		permService: permService,
	}
}

func (s *service) GetActorSnapshot(ctx context.Context, actorID int64) ActorSnapshot {
	if actorID == 0 {
		return ActorSnapshot{Username: "System"}
	}
	if s.userRepo != nil {
		u, err := s.userRepo.GetByID(ctx, actorID)
		if err == nil && u != nil {
			var dn, ak string
			if u.DisplayName != nil {
				dn = *u.DisplayName
			}
			if u.AvatarKey != nil {
				ak = *u.AvatarKey
			}
			return ActorSnapshot{
				ID:          &actorID,
				Username:    u.Username,
				DisplayName: dn,
				AvatarKey:   ak,
			}
		}
	}
	return ActorSnapshot{ID: &actorID, Username: fmt.Sprintf("User %d", actorID)}
}

func (s *service) Log(ctx context.Context, params LogParams) error {
	if params.GuildID == 0 {
		return errors.NewBadRequest("guild_id is required for audit logging")
	}

	entry := &AuditLogEntry{
		ID:               snowflake.GenerateID(),
		GuildID:          params.GuildID,
		ActorID:          params.Actor.ID,
		ActorUsername:    params.Actor.Username,
		ActorDisplayName: params.Actor.DisplayName,
		ActorAvatarKey:   params.Actor.AvatarKey,
		Action:           params.Action,
		TargetType:       params.Target.Type,
		TargetID:         params.Target.ID,
		TargetDisplay:    params.Target.Display,
		Reason:           params.Reason,
	}

	if params.Actor.Username == "" {
		entry.ActorUsername = "System"
	}

	if len(params.Changes) > 0 {
		raw, err := json.Marshal(params.Changes)
		if err == nil {
			rawJSON := json.RawMessage(raw)
			entry.Changes = &rawJSON
		}
	}

	if len(params.Metadata) > 0 {
		raw, err := json.Marshal(params.Metadata)
		if err == nil {
			rawJSON := json.RawMessage(raw)
			entry.Metadata = &rawJSON
		}
	}

	return s.repo.Create(ctx, entry)
}

func (s *service) ListGuildLogs(ctx context.Context, guildID, userID int64, filter AuditLogFilter) ([]AuditLogResponse, error) {
	// Verify VIEW_AUDIT_LOG permission
	allowed, err := s.permService.HasGuildPermission(ctx, guildID, userID, permissions.VIEW_AUDIT_LOG)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, errors.NewForbidden("access denied: view audit log permission required")
	}

	entries, err := s.repo.ListGuildLogs(ctx, guildID, filter)
	if err != nil {
		return nil, err
	}

	responses := make([]AuditLogResponse, 0, len(entries))
	for _, e := range entries {
		var changes Changes
		if e.Changes != nil {
			_ = json.Unmarshal(*e.Changes, &changes)
		}

		var metadata map[string]any
		if e.Metadata != nil {
			_ = json.Unmarshal(*e.Metadata, &metadata)
		}

		resp := AuditLogResponse{
			ID:      e.ID,
			GuildID: e.GuildID,
			Actor: ActorSnapshot{
				ID:          e.ActorID,
				Username:    e.ActorUsername,
				DisplayName: e.ActorDisplayName,
				AvatarKey:   e.ActorAvatarKey,
			},
			Action:   e.Action.String(),
			ActionID: e.Action,
			Target: Target{
				Type:    e.TargetType,
				ID:      e.TargetID,
				Display: e.TargetDisplay,
			},
			Reason:    e.Reason,
			Changes:   changes,
			Metadata:  metadata,
			CreatedAt: e.CreatedAt,
		}

		responses = append(responses, resp)
	}

	return responses, nil
}
