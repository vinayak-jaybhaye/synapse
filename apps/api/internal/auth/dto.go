package auth

import "time"

type RegisterRequest struct {
	Username   string  `json:"username" binding:"required,min=3,max=32"`
	Email      string  `json:"email" binding:"required,email"`
	Password   string  `json:"password" binding:"required,min=8"`
	DeviceID   string  `json:"device_id" binding:"required"`
	Platform   string  `json:"platform" binding:"required"`
	DeviceName *string `json:"device_name,omitempty"`
	PushToken  *string `json:"push_token,omitempty"`
}

type LoginRequest struct {
	Email      string  `json:"email" binding:"required,email"`
	Password   string  `json:"password" binding:"required"`
	DeviceID   string  `json:"device_id" binding:"required"`
	Platform   string  `json:"platform" binding:"required"`
	DeviceName *string `json:"device_name,omitempty"`
	PushToken  *string `json:"push_token,omitempty"`
}

type AuthResponse struct {
	Token string  `json:"token,omitempty"`
	User  UserDTO `json:"user"`
}

type UserDTO struct {
	ID          int64  `json:"id,string"` // Use string tag to prevent JS precision issues with BIGINT
	Username    string `json:"username"`
	DisplayName string `json:"display_name,omitempty"`
	AvatarKey   string `json:"avatar_key,omitempty"`
	Email       string `json:"email"`
}

type DeviceResponse struct {
	ID          int64     `json:"id,string"`
	UserID      int64     `json:"user_id,string"`
	DeviceID    string    `json:"device_id"`
	DeviceName  string    `json:"device_name"`
	Platform    string    `json:"platform"`
	PushToken   *string   `json:"push_token,omitempty"`
	IsTrusted   bool      `json:"is_trusted"`
	Status      string    `json:"status"`
	FirstSeenAt time.Time `json:"first_seen_at"`
	LastSeenAt  time.Time `json:"last_seen_at"`
}

type SessionResponse struct {
	ID         int64           `json:"id,string"`
	UserID     int64           `json:"user_id,string"`
	DeviceID   int64           `json:"device_id,string"`
	IPAddress  *string         `json:"ip_address,omitempty"`
	CreatedAt  time.Time       `json:"created_at"`
	LastUsedAt time.Time       `json:"last_used_at"`
	ExpiresAt  time.Time       `json:"expires_at"`
	RevokedAt  *time.Time      `json:"revoked_at,omitempty"`
	Status     string          `json:"status"`
	Device     *DeviceResponse `json:"device,omitempty"`
}
