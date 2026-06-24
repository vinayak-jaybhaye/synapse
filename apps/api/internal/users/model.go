package users

import "time"

type User struct {
	ID           int64     `json:"id,string"`
	Username     string    `json:"username"`
	DisplayName  *string   `json:"display_name,omitempty"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	AvatarKey    *string   `json:"avatar_key,omitempty"`
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

type DMChannelResponse struct {
	ChannelID   int64 `json:"channel_id,string"`
	RecipientID int64 `json:"recipient_id,string"`
}
