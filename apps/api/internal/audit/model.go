package audit

import (
	"encoding/json"
	"time"
)

type Action int16

const (
	ActionGuildUpdate Action = iota + 1
)

const (
	ActionChannelCreate Action = 100 + iota
	ActionChannelUpdate
	ActionChannelDelete
	ActionChannelMove
	ActionChannelPermissionCreate
	ActionChannelPermissionUpdate
	ActionChannelPermissionDelete
)

const (
	ActionRoleCreate Action = 200 + iota
	ActionRoleUpdate
	ActionRoleDelete
)

const (
	ActionMemberKick Action = 300 + iota
	ActionMemberBan
	ActionMemberUnban
	ActionMemberNickUpdate
	ActionMemberRoleAdd
	ActionMemberRoleRemove
	ActionMemberTimeout
	ActionMemberAdd
	ActionMemberLeave
)

const (
	ActionInviteCreate Action = 400 + iota
	ActionInviteDelete
)

const (
	ActionMessageDelete Action = 500 + iota
	ActionMessageBulkDelete
)

const (
	ActionVoiceMove Action = 600 + iota
	ActionVoiceDisconnect
)

const (
	ActionWebhookCreate Action = 700 + iota
	ActionWebhookUpdate
	ActionWebhookDelete
)

const (
	ActionEmojiCreate Action = 800 + iota
	ActionEmojiUpdate
	ActionEmojiDelete
)

// String returns a human-readable action representation.
func (a Action) String() string {
	switch a {
	case ActionGuildUpdate:
		return "GUILD_UPDATE"
	case ActionChannelCreate:
		return "CHANNEL_CREATE"
	case ActionChannelUpdate:
		return "CHANNEL_UPDATE"
	case ActionChannelDelete:
		return "CHANNEL_DELETE"
	case ActionChannelMove:
		return "CHANNEL_MOVE"
	case ActionChannelPermissionCreate:
		return "CHANNEL_PERMISSION_CREATE"
	case ActionChannelPermissionUpdate:
		return "CHANNEL_PERMISSION_UPDATE"
	case ActionChannelPermissionDelete:
		return "CHANNEL_PERMISSION_DELETE"
	case ActionRoleCreate:
		return "ROLE_CREATE"
	case ActionRoleUpdate:
		return "ROLE_UPDATE"
	case ActionRoleDelete:
		return "ROLE_DELETE"
	case ActionMemberKick:
		return "MEMBER_KICK"
	case ActionMemberBan:
		return "MEMBER_BAN"
	case ActionMemberUnban:
		return "MEMBER_UNBAN"
	case ActionMemberNickUpdate:
		return "MEMBER_NICK_UPDATE"
	case ActionMemberRoleAdd:
		return "MEMBER_ROLE_ADD"
	case ActionMemberRoleRemove:
		return "MEMBER_ROLE_REMOVE"
	case ActionMemberTimeout:
		return "MEMBER_TIMEOUT"
	case ActionMemberAdd:
		return "MEMBER_ADD"
	case ActionMemberLeave:
		return "MEMBER_LEAVE"
	case ActionInviteCreate:
		return "INVITE_CREATE"
	case ActionInviteDelete:
		return "INVITE_DELETE"
	case ActionMessageDelete:
		return "MESSAGE_DELETE"
	case ActionMessageBulkDelete:
		return "MESSAGE_BULK_DELETE"
	case ActionVoiceMove:
		return "VOICE_MOVE"
	case ActionVoiceDisconnect:
		return "VOICE_DISCONNECT"
	case ActionWebhookCreate:
		return "WEBHOOK_CREATE"
	case ActionWebhookUpdate:
		return "WEBHOOK_UPDATE"
	case ActionWebhookDelete:
		return "WEBHOOK_DELETE"
	case ActionEmojiCreate:
		return "EMOJI_CREATE"
	case ActionEmojiUpdate:
		return "EMOJI_UPDATE"
	case ActionEmojiDelete:
		return "EMOJI_DELETE"
	default:
		return "UNKNOWN_ACTION"
	}
}

type TargetType int16

const (
	TargetGuild TargetType = iota + 1
	TargetChannel
	TargetRole
	TargetUser
	TargetMember
	TargetInvite
	TargetMessage
	TargetVoiceSession
)

func (t TargetType) String() string {
	switch t {
	case TargetGuild:
		return "GUILD"
	case TargetChannel:
		return "CHANNEL"
	case TargetRole:
		return "ROLE"
	case TargetUser:
		return "USER"
	case TargetMember:
		return "MEMBER"
	case TargetInvite:
		return "INVITE"
	case TargetMessage:
		return "MESSAGE"
	case TargetVoiceSession:
		return "VOICE_SESSION"
	default:
		return "UNKNOWN_TARGET"
	}
}

// ActorSnapshot holds a static copy of the actor's profile at log time.
type ActorSnapshot struct {
	ID          *int64 `json:"id,string,omitempty"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name,omitempty"`
	AvatarKey   string `json:"avatar_key,omitempty"`
}

// Target holds the target's resource reference and human readable display snapshot.
type Target struct {
	Type    TargetType `json:"type"`
	ID      *int64     `json:"id,string,omitempty"`
	Display string     `json:"display,omitempty"`
}

// ChangeValue represents a single field's before/after state.
type ChangeValue struct {
	Old any `json:"old"`
	New any `json:"new"`
}

// Changes maps field names to before/after values.
type Changes map[string]ChangeValue

// LogParams is passed to AuditService.Log when registering an audit entry.
type LogParams struct {
	GuildID  int64
	Actor    ActorSnapshot
	Action   Action
	Target   Target
	Reason   *string
	Changes  Changes
	Metadata map[string]any
}

// AuditLogEntry is the internal database model for an audit log row.
type AuditLogEntry struct {
	ID               int64
	GuildID          int64
	ActorID          *int64
	ActorUsername    string
	ActorDisplayName string
	ActorAvatarKey   string
	Action           Action
	TargetType       TargetType
	TargetID         *int64
	TargetDisplay    string
	Reason           *string
	Changes          *json.RawMessage
	Metadata         *json.RawMessage
	CreatedAt        time.Time
}

// AuditLogFilter specifies query criteria for listing guild audit logs.
type AuditLogFilter struct {
	BeforeID   *int64
	Limit      int
	Action     *Action
	ActorID    *int64
	TargetType *TargetType
	TargetID   *int64
}

// AuditLogResponse is the clean DTO returned to clients/frontend.
type AuditLogResponse struct {
	ID        int64          `json:"id,string"`
	GuildID   int64          `json:"guild_id,string"`
	Actor     ActorSnapshot  `json:"actor"`
	Action    string         `json:"action"`
	ActionID  Action         `json:"action_id"`
	Target    Target         `json:"target"`
	Reason    *string        `json:"reason,omitempty"`
	Changes   Changes        `json:"changes,omitempty"`
	Metadata  map[string]any `json:"metadata,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
}
