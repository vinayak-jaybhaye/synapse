package notifications

import (
	"encoding/json"
	"time"
)

type NotificationSettings struct {
	ID        int64      `json:"id,string"`
	UserID    int64      `json:"user_id,string"`
	GuildID   *int64     `json:"guild_id,string,omitempty"`
	ChannelID *int64     `json:"channel_id,string,omitempty"`
	MuteUntil *time.Time `json:"mute_until,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

type NotificationType int16
type ReferenceType int16

const (
	TypeMention        NotificationType = 1
	TypeReply          NotificationType = 2
	TypeReaction       NotificationType = 3
	TypeFriendRequest  NotificationType = 4
	TypeFriendAccepted NotificationType = 5
	TypeGuildInvite    NotificationType = 6
	TypeChannelInvite  NotificationType = 7
	TypeMissedCall     NotificationType = 8
	TypeSystem         NotificationType = 9

	RefMessage ReferenceType = 1
	RefChannel ReferenceType = 2
	RefGuild   ReferenceType = 3
	RefInvite  ReferenceType = 4
	RefUser    ReferenceType = 5
	RefCall    ReferenceType = 6
	RefThread  ReferenceType = 7
)

type Notification struct {
	ID               int64            `json:"id,string"`
	RecipientID      int64            `json:"recipient_id,string"`
	ActorID          *int64           `json:"actor_id,string,omitempty"`
	Type             NotificationType `json:"type"`
	ReferenceType    ReferenceType    `json:"reference_type"`
	ReferenceID      int64            `json:"reference_id,string"`
	Metadata         *json.RawMessage `json:"metadata,omitempty"`
	DeduplicationKey *string          `json:"-"`
	IsRead           bool             `json:"is_read"`
	ReadAt           *time.Time       `json:"read_at,omitempty"`
	CreatedAt        time.Time        `json:"created_at"`
}

type NotificationResponse struct {
	ID            int64            `json:"id,string"`
	RecipientID   int64            `json:"recipient_id,string"`
	ActorID       *int64           `json:"actor_id,string,omitempty"`
	Type          NotificationType `json:"type"`
	ReferenceType ReferenceType    `json:"reference_type"`
	ReferenceID   int64            `json:"reference_id,string"`
	Metadata      *json.RawMessage `json:"metadata,omitempty"`
	IsRead        bool             `json:"is_read"`
	ReadAt        *time.Time       `json:"read_at,omitempty"`
	CreatedAt     time.Time        `json:"created_at"`
}

type PutNotificationSettingsRequest struct {
	MuteUntil *time.Time `json:"mute_until"`
}
