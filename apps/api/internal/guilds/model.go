package guilds

import "time"

type Guild struct {
	ID          int64      `json:"id,string"`
	OwnerID     int64      `json:"owner_id,string"`
	Name        string     `json:"name"`
	Description *string    `json:"description,omitempty"`
	IconKey     *string    `json:"icon_key,omitempty"`
	BannerKey   *string    `json:"banner_key,omitempty"`
	Version     int        `json:"version"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	DeletedAt   *time.Time `json:"-"`
}

type GuildMember struct {
	GuildID  int64     `json:"guild_id,string"`
	UserID   int64     `json:"user_id,string"`
	Nickname *string   `json:"nickname,omitempty"`
	JoinedAt time.Time `json:"joined_at"`
	IsMuted  bool      `json:"is_muted"`
}

type MemberWithUser struct {
	GuildID     int64     `json:"guild_id,string"`
	UserID      int64     `json:"user_id,string"`
	Username    string    `json:"username"`
	DisplayName *string   `json:"display_name,omitempty"`
	AvatarKey   *string   `json:"avatar_key,omitempty"`
	Nickname    *string   `json:"nickname,omitempty"`
	JoinedAt    time.Time `json:"joined_at"`
	IsMuted     bool      `json:"is_muted"`
	Roles       []string  `json:"roles"`
}

type CreateGuildRequest struct {
	Name        string  `json:"name" binding:"required,min=2,max=100"`
	Description *string `json:"description,omitempty"`
}

type UpdateMemberRequest struct {
	Nickname *string `json:"nickname,omitempty"`
	IsMuted  *bool   `json:"is_muted,omitempty"`
}


type UpdateGuildRequest struct {
	Name           *string `json:"name,omitempty"`
	Description    *string `json:"description,omitempty"`
	IconUploadID   *int64  `json:"icon_upload_id,string,omitempty"`
	BannerUploadID *int64  `json:"banner_upload_id,string,omitempty"`
	RemoveIcon     *bool   `json:"remove_icon,omitempty"`
	RemoveBanner   *bool   `json:"remove_banner,omitempty"`
}
