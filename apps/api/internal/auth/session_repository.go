package auth

import (
	"context"
	"time"
)

type Device struct {
	ID          int64      `json:"id,string"`
	UserID      int64      `json:"user_id,string"`
	DeviceID    string     `json:"device_id"`
	DeviceName  string     `json:"device_name"`
	Platform    string     `json:"platform"`
	PushToken   *string    `json:"push_token,omitempty"`
	IsTrusted   bool       `json:"is_trusted"`
	Status      string     `json:"status"` // ACTIVE | REVOKED
	FirstSeenAt time.Time  `json:"first_seen_at"`
	LastSeenAt  time.Time  `json:"last_seen_at"`
	RevokedAt   *time.Time `json:"revoked_at,omitempty"`
}

type Session struct {
	ID         int64      `json:"id,string"`
	UserID     int64      `json:"user_id,string"`
	DeviceID   int64      `json:"device_id,string"`
	TokenHash  string     `json:"-"`
	IPAddress  *string    `json:"ip_address,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	LastUsedAt time.Time  `json:"last_used_at"`
	ExpiresAt  time.Time  `json:"expires_at"`
	RevokedAt  *time.Time `json:"revoked_at,omitempty"`
}

type SessionRepository interface {
	// Device operations
	UpsertDevice(ctx context.Context, d *Device) error
	GetDevice(ctx context.Context, userID int64, deviceID string) (*Device, error)
	GetDeviceByID(ctx context.Context, id int64) (*Device, error)
	ListDevices(ctx context.Context, userID int64) ([]Device, error)
	RevokeDevice(ctx context.Context, userID int64, deviceID int64) error

	// Session operations
	CreateSession(ctx context.Context, s *Session) error
	GetSessionByHash(ctx context.Context, tokenHash string) (*Session, error)
	GetSessionByID(ctx context.Context, id int64) (*Session, error)
	ListSessions(ctx context.Context, userID int64) ([]SessionResponse, error)
	RevokeSession(ctx context.Context, userID int64, sessionID int64) error
	RevokeAllSessions(ctx context.Context, userID int64) error

	// Throttled activity updates
	UpdateSessionActivity(ctx context.Context, sessionID int64, lastUsedAt time.Time) error
	UpdateDeviceActivity(ctx context.Context, deviceID int64, lastSeenAt time.Time) error

	// Purge task
	CleanupExpiredSessions(ctx context.Context, gracePeriod time.Duration) (int64, error)
}
