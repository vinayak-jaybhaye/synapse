package channels

import "time"

type Channel struct {
	ID              int64      `json:"id,string"`
	GuildID         *int64     `json:"guild_id,string,omitempty"`
	ParentChannelID *int64     `json:"parent_channel_id,string,omitempty"`
	Name            string     `json:"name"`
	Type            int        `json:"type"` // 0: Text, 1: Voice, 2: Category, 3: DM, 4: Group DM
	Position        int        `json:"position"`
	Topic           *string    `json:"topic,omitempty"`
	Version         int        `json:"version"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	DeletedAt       *time.Time `json:"-"`
}

type CreateChannelRequest struct {
	Name            string  `json:"name" binding:"required,min=1,max=100"`
	Type            int     `json:"type" binding:"min=0,max=2"` // Allow creating Text, Voice, or Category
	ParentChannelID *int64  `json:"parent_channel_id,string,omitempty"`
	Topic           *string `json:"topic,omitempty"`
}

type UpdateChannelRequest struct {
	Name            *string `json:"name,omitempty"`
	ParentChannelID *int64  `json:"parent_channel_id,string,omitempty"`
	Topic           *string `json:"topic,omitempty"`
	Position        *int    `json:"position,omitempty"`
}

type ChannelRolePermissionOverride struct {
	ChannelID        int64  `json:"channel_id,string"`
	RoleID           int64  `json:"role_id,string"`
	AllowPermissions int64  `json:"-"`
	DenyPermissions  int64  `json:"-"`
	AllowPermsString string `json:"allow_permissions"`
	DenyPermsString  string `json:"deny_permissions"`
}

type PutRoleOverrideRequest struct {
	AllowPermissions string `json:"allow_permissions"`
	DenyPermissions  string `json:"deny_permissions"`
}
