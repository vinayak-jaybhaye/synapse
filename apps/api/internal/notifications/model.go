package notifications

import "time"

type NotificationSettings struct {
	ID        int64      `json:"id,string"`
	UserID    int64      `json:"user_id,string"`
	GuildID   *int64     `json:"guild_id,string,omitempty"`
	ChannelID *int64     `json:"channel_id,string,omitempty"`
	MuteUntil *time.Time `json:"mute_until,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

type PutNotificationSettingsRequest struct {
	MuteUntil *time.Time `json:"mute_until"`
}
