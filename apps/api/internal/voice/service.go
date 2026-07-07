package voice

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	lkproto "github.com/livekit/protocol/livekit"
	"github.com/synapse/api/internal/errors"
	"github.com/synapse/api/internal/permissions"
)

// Service is the voice business logic interface.
type Service interface {
	JoinVoiceChannel(ctx context.Context, guildID, channelID, userID int64) (*JoinVoiceResponse, error)
	LeaveVoiceChannel(ctx context.Context, guildID, channelID, userID int64) error
	GetChannelVoiceStates(ctx context.Context, guildID, channelID int64) ([]VoiceState, error)

	// Moderator actions
	ServerMute(ctx context.Context, guildID, channelID, actorID, targetID int64, muted bool) error
	ServerDeafen(ctx context.Context, guildID, channelID, actorID, targetID int64, deafened bool) error
	DisconnectMember(ctx context.Context, guildID, channelID, actorID, targetID int64) error
	MoveMember(ctx context.Context, guildID, srcChannelID, dstChannelID, actorID, targetID int64) error

	// LiveKit webhook
	HandleWebhook(r *http.Request) error
}

type service struct {
	repo        Repository
	lk          *LiveKitClient
	permService permissions.Service
	stateTTL    time.Duration
	lkWSURL     string
}

// NewService constructs the voice service.
func NewService(
	repo Repository,
	lk *LiveKitClient,
	permService permissions.Service,
	stateTTL time.Duration,
	lkWSURL string,
) Service {
	return &service{
		repo:        repo,
		lk:          lk,
		permService: permService,
		stateTTL:    stateTTL,
		lkWSURL:     lkWSURL,
	}
}

// ── Join / Leave ──────────────────────────────────────────────────────────────

func (s *service) JoinVoiceChannel(ctx context.Context, guildID, channelID, userID int64) (*JoinVoiceResponse, error) {
	// 1. Validate CONNECT permission
	perm, err := s.permService.ResolveChannelPermissions(ctx, guildID, channelID, userID)
	if err != nil {
		return nil, err
	}
	if !permissions.HasPermission(perm, permissions.CONNECT) {
		return nil, errors.NewForbidden("you do not have permission to connect to this voice channel")
	}

	// 2. If user is already in a voice channel in this guild, leave it first
	existing, err := s.repo.GetVoiceState(ctx, guildID, userID)
	if err == nil && existing != nil && existing.ChannelID != channelID {
		oldRoomName := RoomName(guildID, existing.ChannelID)
		identity := fmt.Sprintf("%d", userID)
		_ = s.lk.RemoveParticipant(ctx, oldRoomName, identity)
		_ = s.repo.DeleteVoiceState(ctx, guildID, userID, existing.ChannelID)
	}

	// 3. Generate LiveKit token
	roomName := RoomName(guildID, channelID)
	identity := fmt.Sprintf("%d", userID)
	token, err := s.lk.GenerateToken(roomName, identity)
	if err != nil {
		return nil, fmt.Errorf("voice: failed to generate token: %w", err)
	}

	return &JoinVoiceResponse{
		LiveKitURL: s.lkWSURL,
		Token:      token,
		ExpiresIn:  int(tokenTTL.Seconds()),
	}, nil
}

func (s *service) LeaveVoiceChannel(ctx context.Context, guildID, channelID, userID int64) error {
	roomName := RoomName(guildID, channelID)
	identity := fmt.Sprintf("%d", userID)
	_ = s.lk.RemoveParticipant(ctx, roomName, identity)
	return nil
}

func (s *service) GetChannelVoiceStates(ctx context.Context, guildID, channelID int64) ([]VoiceState, error) {
	return s.repo.ListChannelVoiceStates(ctx, guildID, channelID)
}

// ── Moderator Actions ─────────────────────────────────────────────────────────

func (s *service) ServerMute(ctx context.Context, guildID, channelID, actorID, targetID int64, muted bool) error {
	if err := s.checkModPerm(ctx, guildID, channelID, actorID, permissions.MUTE_MEMBERS); err != nil {
		return err
	}

	state, err := s.repo.GetVoiceState(ctx, guildID, targetID)
	if err != nil || state == nil {
		// Fallback to LiveKit if Redis state is missing or delayed
		roomName := RoomName(guildID, channelID)
		identity := fmt.Sprintf("%d", targetID)
		info, lkErr := s.lk.GetParticipant(ctx, roomName, identity)
		if lkErr != nil || info == nil {
			return errors.NewNotFound("target user is not in a voice channel")
		}
		state = &VoiceState{
			UserID:    targetID,
			ChannelID: channelID,
			GuildID:   guildID,
			JoinedAt:  time.Now(),
		}
		for _, t := range info.Tracks {
			if t.Type == lkproto.TrackType_AUDIO {
				state.SelfMute = t.Muted
			} else if t.Type == lkproto.TrackType_VIDEO {
				if t.Source == lkproto.TrackSource_SCREEN_SHARE {
					state.ScreenShare = !t.Muted
				} else {
					state.Video = !t.Muted
				}
			}
		}
		if info.Metadata != "" {
			var meta struct {
				SelfDeaf *bool `json:"self_deaf"`
			}
			if err := json.Unmarshal([]byte(info.Metadata), &meta); err == nil && meta.SelfDeaf != nil {
				state.SelfDeaf = *meta.SelfDeaf
			}
		}
	}

	state.ServerMute = muted
	if muted {
		state.SelfMute = true // force muted at UI layer too
	}

	if err := s.repo.UpsertVoiceState(ctx, state); err != nil {
		return err
	}

	// Build metadata JSON payload to keep self_deaf, server_mute and server_deaf in sync in LiveKit
	metaObj := map[string]bool{
		"self_deaf":   state.SelfDeaf,
		"server_mute": state.ServerMute,
		"server_deaf": state.ServerDeaf,
	}
	metaBytes, _ := json.Marshal(metaObj)
	metaStr := string(metaBytes)

	roomName := RoomName(guildID, state.ChannelID)
	identity := fmt.Sprintf("%d", targetID)
	if err := s.lk.ApplyParticipantPermissions(ctx, roomName, identity, !state.ServerMute, !state.ServerDeaf, !state.ServerDeaf, metaStr); err != nil {
		slog.Error("voice: failed to apply participant permissions in LiveKit", "err", err, "room", roomName, "identity", identity)
		return err
	}

	return nil
}

func (s *service) ServerDeafen(ctx context.Context, guildID, channelID, actorID, targetID int64, deafened bool) error {
	if err := s.checkModPerm(ctx, guildID, channelID, actorID, permissions.DEAFEN_MEMBERS); err != nil {
		return err
	}

	state, err := s.repo.GetVoiceState(ctx, guildID, targetID)
	if err != nil || state == nil {
		// Fallback to LiveKit if Redis state is missing or delayed
		roomName := RoomName(guildID, channelID)
		identity := fmt.Sprintf("%d", targetID)
		info, lkErr := s.lk.GetParticipant(ctx, roomName, identity)
		if lkErr != nil || info == nil {
			return errors.NewNotFound("target user is not in a voice channel")
		}
		state = &VoiceState{
			UserID:    targetID,
			ChannelID: channelID,
			GuildID:   guildID,
			JoinedAt:  time.Now(),
		}
		for _, t := range info.Tracks {
			if t.Type == lkproto.TrackType_AUDIO {
				state.SelfMute = t.Muted
			} else if t.Type == lkproto.TrackType_VIDEO {
				if t.Source == lkproto.TrackSource_SCREEN_SHARE {
					state.ScreenShare = !t.Muted
				} else {
					state.Video = !t.Muted
				}
			}
		}
		if info.Metadata != "" {
			var meta struct {
				SelfDeaf *bool `json:"self_deaf"`
			}
			if err := json.Unmarshal([]byte(info.Metadata), &meta); err == nil && meta.SelfDeaf != nil {
				state.SelfDeaf = *meta.SelfDeaf
			}
		}
	}

	state.ServerDeaf = deafened
	if deafened {
		state.SelfDeaf = true
	}

	if err := s.repo.UpsertVoiceState(ctx, state); err != nil {
		return err
	}

	// Build metadata JSON payload to keep self_deaf, server_mute and server_deaf in sync in LiveKit
	metaObj := map[string]bool{
		"self_deaf":   state.SelfDeaf,
		"server_mute": state.ServerMute,
		"server_deaf": state.ServerDeaf,
	}
	metaBytes, _ := json.Marshal(metaObj)
	metaStr := string(metaBytes)

	roomName := RoomName(guildID, state.ChannelID)
	identity := fmt.Sprintf("%d", targetID)
	if err := s.lk.ApplyParticipantPermissions(ctx, roomName, identity, !state.ServerMute, !state.ServerDeaf, !state.ServerDeaf, metaStr); err != nil {
		slog.Error("voice: failed to apply participant permissions in LiveKit", "err", err, "room", roomName, "identity", identity)
		return err
	}

	return nil
}

func (s *service) DisconnectMember(ctx context.Context, guildID, channelID, actorID, targetID int64) error {
	if err := s.checkModPerm(ctx, guildID, channelID, actorID, permissions.MOVE_MEMBERS); err != nil {
		return err
	}

	roomName := RoomName(guildID, channelID)
	identity := fmt.Sprintf("%d", targetID)

	// Remove from LiveKit directly
	_ = s.lk.RemoveParticipant(ctx, roomName, identity)

	// Delete voice state in Redis (triggers leave event propagation)
	_ = s.repo.DeleteVoiceState(ctx, guildID, targetID, channelID)

	return nil
}

func (s *service) MoveMember(ctx context.Context, guildID, srcChannelID, dstChannelID, actorID, targetID int64) error {
	if err := s.checkModPerm(ctx, guildID, srcChannelID, actorID, permissions.MOVE_MEMBERS); err != nil {
		return err
	}

	// Check target has CONNECT permission in destination channel
	perm, err := s.permService.ResolveChannelPermissions(ctx, guildID, dstChannelID, targetID)
	if err != nil {
		return err
	}
	if !permissions.HasPermission(perm, permissions.CONNECT) {
		return errors.NewForbidden("target user does not have permission to connect to the destination channel")
	}

	// Remove from src LiveKit room
	state, err := s.repo.GetVoiceState(ctx, guildID, targetID)
	if err != nil || state == nil {
		return errors.NewNotFound("target user is not in a voice channel")
	}

	srcRoom := RoomName(guildID, srcChannelID)
	identity := fmt.Sprintf("%d", targetID)
	_ = s.lk.RemoveParticipant(ctx, srcRoom, identity)

	// Update state to new channel atomically in repository
	_ = s.repo.MoveVoiceState(ctx, guildID, targetID, srcChannelID, dstChannelID)

	return nil
}

// ── LiveKit Webhook ───────────────────────────────────────────────────────────

// HandleWebhook processes an incoming LiveKit webhook from an http.Request.
func (s *service) HandleWebhook(r *http.Request) error {
	event, err := s.lk.VerifyWebhook(r)
	if err != nil {
		return errors.NewBadRequest("invalid webhook signature")
	}

	ctx := r.Context()
	if event.Room == nil || event.Participant == nil {
		return nil
	}

	roomName := event.Room.Name
	var guildID, channelID int64
	if _, err := fmt.Sscanf(roomName, "guild-%d-channel-%d", &guildID, &channelID); err != nil {
		return nil
	}
	userID, err := parseIdentity(event.Participant.Identity)
	if err != nil {
		return nil
	}

	switch event.Event {
	case "participant_joined", "track_published", "track_unpublished", "track_muted", "track_unmuted", "participant_active", "participant_metadata_changed":
		if err := s.syncVoiceState(ctx, roomName, event.Participant); err != nil {
			slog.Warn("voice: failed to sync voice state from webhook", "event", event.Event, "err", err)
		}

	case "participant_left":
		if err := s.repo.DeleteVoiceState(ctx, guildID, userID, channelID); err != nil {
			slog.Warn("voice: failed to delete voice state on participant leave", "err", err)
		}

	case "room_finished":
		slog.Info("voice: LiveKit room finished", "room", roomName)
	}

	return nil
}

// ── Internals ─────────────────────────────────────────────────────────────────

func (s *service) syncVoiceState(ctx context.Context, roomName string, p *lkproto.ParticipantInfo) error {
	var guildID, channelID int64
	if _, err := fmt.Sscanf(roomName, "guild-%d-channel-%d", &guildID, &channelID); err != nil {
		return err
	}

	userID, err := parseIdentity(p.Identity)
	if err != nil {
		return err
	}

	// 1. Fetch existing voice state to preserve server mutes/deafens
	existing, _ := s.repo.GetVoiceState(ctx, guildID, userID)

	// 2. Compute media flags from participant's tracks
	selfMute := true
	video := false
	screenShare := false
	for _, t := range p.Tracks {
		if t.Type == lkproto.TrackType_AUDIO {
			selfMute = t.Muted
		} else if t.Type == lkproto.TrackType_VIDEO {
			if t.Source == lkproto.TrackSource_SCREEN_SHARE {
				screenShare = !t.Muted
			} else {
				video = !t.Muted
			}
		}
	}

	// 3. Compute flags from metadata if present (e.g. self_deaf)
	selfDeaf := false
	if p.Metadata != "" {
		var meta struct {
			SelfMute    *bool `json:"self_mute"`
			SelfDeaf    *bool `json:"self_deaf"`
			Video       *bool `json:"video"`
			ScreenShare *bool `json:"screen_share"`
		}
		if err := json.Unmarshal([]byte(p.Metadata), &meta); err == nil {
			if meta.SelfMute != nil {
				selfMute = *meta.SelfMute
			}
			if meta.SelfDeaf != nil {
				selfDeaf = *meta.SelfDeaf
			}
			if meta.Video != nil {
				video = *meta.Video
			}
			if meta.ScreenShare != nil {
				screenShare = *meta.ScreenShare
			}
		}
	}

	// 4. Preserve existing ServerMute/ServerDeaf
	serverMute := false
	serverDeaf := false
	if existing != nil {
		serverMute = existing.ServerMute
		serverDeaf = existing.ServerDeaf
		if p.Metadata == "" {
			selfDeaf = existing.SelfDeaf
		}
	}

	// 5. Build final VoiceState
	joinedAt := time.Now()
	if p.JoinedAt > 0 {
		joinedAt = time.Unix(p.JoinedAt, 0)
	}

	state := &VoiceState{
		UserID:      userID,
		ChannelID:   channelID,
		GuildID:     guildID,
		SelfMute:    selfMute,
		SelfDeaf:    selfDeaf,
		ServerMute:  serverMute,
		ServerDeaf:  serverDeaf,
		Video:       video,
		ScreenShare: screenShare,
		JoinedAt:    joinedAt,
	}

	return s.repo.UpsertVoiceState(ctx, state)
}

func (s *service) checkModPerm(ctx context.Context, guildID, channelID, actorID int64, perm permissions.Permission) error {
	resolved, err := s.permService.ResolveChannelPermissions(ctx, guildID, channelID, actorID)
	if err != nil {
		return err
	}
	if !permissions.HasPermission(resolved, perm) {
		return errors.NewForbidden("insufficient moderator permissions")
	}
	return nil
}

func parseIdentity(identity string) (int64, error) {
	var id int64
	_, err := fmt.Sscanf(identity, "%d", &id)
	return id, err
}

// Ensure tokenTTL is accessible for response serialization
var _ = lkproto.TrackType_AUDIO
