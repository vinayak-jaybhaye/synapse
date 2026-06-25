package invites

import "time"

type Invite struct {
	ID        int64      `json:"id,string"`
	GuildID   int64      `json:"guild_id,string"`
	CreatedBy int64      `json:"created_by,string"`
	Code      string     `json:"code"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	MaxUses   int        `json:"max_uses"`
	Uses      int        `json:"uses"`
	CreatedAt time.Time  `json:"created_at"`
}

type InviteMetadata struct {
	Code        string     `json:"code"`
	GuildID     int64      `json:"guild_id,string"`
	GuildName   string     `json:"guild_name"`
	IconKey     *string    `json:"icon_key,omitempty"`
	MemberCount int        `json:"member_count"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
}

type CreateInviteRequest struct {
	MaxUses  int `json:"max_uses"` // 0 = infinite
	Duration int `json:"duration"` // seconds, 0 = infinite
}
