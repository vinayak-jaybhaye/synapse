package users

import "time"

type User struct {
	ID           int64     `json:"id,string"`
	Username     string    `json:"username"`
	DisplayName  *string   `json:"display_name,omitempty"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	AvatarKey    *string   `json:"avatar_key,omitempty"`
	BannerKey    *string   `json:"banner_key,omitempty"`
	Bio          *string   `json:"bio,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type UserGuildDTO struct {
	ID          int64   `json:"id,string"`
	Name        string  `json:"name"`
	IconKey     *string `json:"icon_key,omitempty"`
	OwnerID     int64   `json:"owner_id,string"`
	UnreadCount int     `json:"unread_count"`
}

type CreateDMRequest struct {
	RecipientID int64 `json:"recipient_id,string" binding:"required"`
}

type UserSummary struct {
	ID          int64  `json:"id,string"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	AvatarKey   string `json:"avatar_key"`
	BannerKey   string `json:"banner_key,omitempty"`
	Bio         string `json:"bio,omitempty"`
}

type DMChannelResponse struct {
	ChannelID   int64       `json:"channel_id,string"`
	Recipient   UserSummary `json:"recipient"`
}

type UserProfile struct {
	ID           int64     `json:"id,string"`
	Username     string    `json:"username"`
	DisplayName  string    `json:"display_name"`
	AvatarKey    string    `json:"avatar_key,omitempty"`
	BannerKey    string    `json:"banner_key,omitempty"`
	Bio          string    `json:"bio,omitempty"`
	Status       string    `json:"status,omitempty"`
	MutualGuilds int       `json:"mutual_guilds"`
	CreatedAt    time.Time `json:"created_at"`
}
