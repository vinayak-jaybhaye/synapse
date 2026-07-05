package auth

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/synapse/api/internal/config"
)

// Mock implementation of SessionRepository
type mockSessionRepo struct {
	devices  map[int64]*Device
	sessions map[int64]*Session
}

func newMockSessionRepo() *mockSessionRepo {
	return &mockSessionRepo{
		devices:  make(map[int64]*Device),
		sessions: make(map[int64]*Session),
	}
}

func (m *mockSessionRepo) UpsertDevice(ctx context.Context, d *Device) error {
	for _, dev := range m.devices {
		if dev.UserID == d.UserID && dev.DeviceID == d.DeviceID {
			// Re-activate previously revoked devices, matching real UpsertDevice behaviour.
			dev.Status = "ACTIVE"
			dev.RevokedAt = nil
			dev.LastSeenAt = time.Now()
			if d.PushToken != nil {
				dev.PushToken = d.PushToken
			}
			d.ID = dev.ID
			d.Status = "ACTIVE"
			d.IsTrusted = dev.IsTrusted
			d.FirstSeenAt = dev.FirstSeenAt
			d.LastSeenAt = dev.LastSeenAt
			return nil
		}
	}
	d.ID = int64(len(m.devices) + 1)
	d.FirstSeenAt = time.Now()
	d.LastSeenAt = time.Now()
	d.Status = "ACTIVE"
	d.IsTrusted = false
	m.devices[d.ID] = d
	return nil
}

func (m *mockSessionRepo) GetDevice(ctx context.Context, userID int64, deviceID string) (*Device, error) {
	for _, d := range m.devices {
		if d.UserID == userID && d.DeviceID == deviceID {
			return d, nil
		}
	}
	return nil, nil
}

func (m *mockSessionRepo) GetDeviceByID(ctx context.Context, id int64) (*Device, error) {
	return m.devices[id], nil
}

func (m *mockSessionRepo) ListDevices(ctx context.Context, userID int64) ([]Device, error) {
	var list []Device
	for _, d := range m.devices {
		if d.UserID == userID {
			list = append(list, *d)
		}
	}
	return list, nil
}

func (m *mockSessionRepo) RevokeDevice(ctx context.Context, userID int64, deviceID int64) error {
	d, ok := m.devices[deviceID]
	if !ok || d.UserID != userID {
		return sql.ErrNoRows
	}
	d.Status = "REVOKED"
	now := time.Now()
	d.RevokedAt = &now
	for _, s := range m.sessions {
		if s.DeviceID == deviceID && s.UserID == userID {
			s.RevokedAt = &now
		}
	}
	return nil
}

func (m *mockSessionRepo) CreateSession(ctx context.Context, s *Session) error {
	s.ID = int64(len(m.sessions) + 1)
	s.CreatedAt = time.Now()
	s.LastUsedAt = time.Now()
	m.sessions[s.ID] = s
	return nil
}

func (m *mockSessionRepo) GetSessionByHash(ctx context.Context, tokenHash string) (*Session, error) {
	for _, s := range m.sessions {
		if s.TokenHash == tokenHash {
			return s, nil
		}
	}
	return nil, nil
}

func (m *mockSessionRepo) GetSessionByID(ctx context.Context, id int64) (*Session, error) {
	return m.sessions[id], nil
}

func (m *mockSessionRepo) ListSessions(ctx context.Context, userID int64) ([]SessionResponse, error) {
	var list []SessionResponse
	for _, s := range m.sessions {
		if s.UserID == userID {
			d := m.devices[s.DeviceID]
			var dResp *DeviceResponse
			if d != nil {
				dResp = &DeviceResponse{
					ID:          d.ID,
					UserID:      d.UserID,
					DeviceID:    d.DeviceID,
					DeviceName:  d.DeviceName,
					Platform:    d.Platform,
					PushToken:   d.PushToken,
					IsTrusted:   d.IsTrusted,
					Status:      d.Status,
					FirstSeenAt: d.FirstSeenAt,
					LastSeenAt:  d.LastSeenAt,
				}
			}

			status := "ACTIVE"
			if s.RevokedAt != nil {
				status = "REVOKED"
			} else if time.Now().After(s.ExpiresAt) {
				status = "EXPIRED"
			}

			list = append(list, SessionResponse{
				ID:         s.ID,
				UserID:     s.UserID,
				DeviceID:   s.DeviceID,
				IPAddress:  s.IPAddress,
				CreatedAt:  s.CreatedAt,
				LastUsedAt: s.LastUsedAt,
				ExpiresAt:  s.ExpiresAt,
				RevokedAt:  s.RevokedAt,
				Status:     status,
				Device:     dResp,
			})
		}
	}
	return list, nil
}

func (m *mockSessionRepo) RevokeSession(ctx context.Context, userID int64, sessionID int64) error {
	s, ok := m.sessions[sessionID]
	if !ok || s.UserID != userID {
		return sql.ErrNoRows
	}
	now := time.Now()
	s.RevokedAt = &now
	return nil
}

func (m *mockSessionRepo) RevokeAllSessions(ctx context.Context, userID int64) error {
	now := time.Now()
	for _, s := range m.sessions {
		if s.UserID == userID {
			s.RevokedAt = &now
		}
	}
	return nil
}

func (m *mockSessionRepo) UpdateSessionActivity(ctx context.Context, sessionID int64, lastUsedAt time.Time) error {
	if s, ok := m.sessions[sessionID]; ok {
		s.LastUsedAt = lastUsedAt
	}
	return nil
}

func (m *mockSessionRepo) UpdateDeviceActivity(ctx context.Context, deviceID int64, lastSeenAt time.Time) error {
	if d, ok := m.devices[deviceID]; ok {
		d.LastSeenAt = lastSeenAt
	}
	return nil
}

func (m *mockSessionRepo) CleanupExpiredSessions(ctx context.Context, gracePeriod time.Duration) (int64, error) {
	var count int64
	threshold := time.Now().Add(-gracePeriod)
	for id, s := range m.sessions {
		if s.ExpiresAt.Before(threshold) {
			delete(m.sessions, id)
			count++
		}
	}
	return count, nil
}

func TestSessionService(t *testing.T) {
	ctx := context.Background()
	userRepo := NewMemoryUserRepository()
	sessionRepo := newMockSessionRepo()
	cfg := &config.Config{
		SessionCookieName:   "session_token",
		SessionCookieSecure: false,
		SessionTTL:          24 * time.Hour,
	}

	svc := NewSessionService(sessionRepo, userRepo, cfg)

	// Pre-create user for testing
	hashedPassword, _ := HashPassword("password123")
	user := &User{
		Username:     "tester",
		Email:        "tester@example.com",
		PasswordHash: hashedPassword,
		DisplayName:  "Tester",
	}
	_ = userRepo.CreateUser(ctx, user)

	t.Run("Login creates session and device", func(t *testing.T) {
		req := &LoginRequest{
			Email:      "tester@example.com",
			Password:   "password123",
			DeviceID:   "device-1",
			Platform:   "web",
			DeviceName: nil,
		}

		resp, token, err := svc.Login(ctx, req, "127.0.0.1", "Mozilla/5.0")
		if err != nil {
			t.Fatalf("Expected login to succeed, got %v", err)
		}
		if token == "" {
			t.Fatal("Expected raw token to be generated")
		}
		if resp.User.ID != user.ID {
			t.Errorf("Expected User ID %d, got %d", user.ID, resp.User.ID)
		}

		// Verify device created
		devices, _ := sessionRepo.ListDevices(ctx, user.ID)
		if len(devices) != 1 || devices[0].DeviceID != "device-1" {
			t.Errorf("Expected 1 device 'device-1', got %v", devices)
		}

		// Verify session created
		sessions, _ := sessionRepo.ListSessions(ctx, user.ID)
		if len(sessions) != 1 {
			t.Errorf("Expected 1 session, got %d", len(sessions))
		}
	})

	t.Run("Expired session rejected", func(t *testing.T) {
		// Insert an expired session manually
		expiredSession := &Session{
			UserID:    user.ID,
			DeviceID:  1,
			TokenHash: svc.(*sessionService).hashToken("expired-token"),
			ExpiresAt: time.Now().Add(-1 * time.Hour),
		}
		_ = sessionRepo.CreateSession(ctx, expiredSession)

		_, err := svc.ValidateSessionToken(ctx, "expired-token")
		if err == nil || err.Error() != "session expired" {
			t.Errorf("Expected validation failure due to expiry, got %v", err)
		}
	})

	t.Run("Revoked session rejected", func(t *testing.T) {
		// Create a revoked session
		revokedSession := &Session{
			UserID:    user.ID,
			DeviceID:  1,
			TokenHash: svc.(*sessionService).hashToken("revoked-token"),
			ExpiresAt: time.Now().Add(1 * time.Hour),
		}
		now := time.Now()
		revokedSession.RevokedAt = &now
		_ = sessionRepo.CreateSession(ctx, revokedSession)

		_, err := svc.ValidateSessionToken(ctx, "revoked-token")
		if err == nil || err.Error() != "session revoked" {
			t.Errorf("Expected validation failure due to revoke, got %v", err)
		}
	})

	t.Run("Device revocation cascades to sessions", func(t *testing.T) {
		// Log in first to create a device and active session
		loginReq := &LoginRequest{
			Email:      "tester@example.com",
			Password:   "password123",
			DeviceID:   "device-to-revoke",
			Platform:   "web",
			DeviceName: nil,
		}
		_, token, _ := svc.Login(ctx, loginReq, "127.0.0.1", "Mozilla/5.0")

		session, err := svc.ValidateSessionToken(ctx, token)
		if err != nil {
			t.Fatalf("Session validation failed: %v", err)
		}

		// Revoke the device
		err = svc.RevokeDevice(ctx, user.ID, session.DeviceID)
		if err != nil {
			t.Fatalf("Device revocation failed: %v", err)
		}

		// Session validation should now fail
		_, err = svc.ValidateSessionToken(ctx, token)
		if err == nil {
			t.Fatal("Expected validation to fail after device revocation")
		}
	})

	t.Run("Listings only return user's own data", func(t *testing.T) {
		// Register a second user
		user2 := &User{
			Username:     "tester2",
			Email:        "tester2@example.com",
			PasswordHash: hashedPassword,
			DisplayName:  "Tester 2",
		}
		_ = userRepo.CreateUser(ctx, user2)

		// Create session/device for user2
		loginReq := &LoginRequest{
			Email:      "tester2@example.com",
			Password:   "password123",
			DeviceID:   "device-user2",
			Platform:   "web",
			DeviceName: nil,
		}
		_, _, _ = svc.Login(ctx, loginReq, "127.0.0.1", "Mozilla/5.0")

		// Query lists for user1 (tester)
		devices, _ := svc.ListDevices(ctx, user.ID)
		for _, d := range devices {
			if d.UserID != user.ID {
				t.Errorf("Leaked device owned by %d to user %d", d.UserID, user.ID)
			}
		}

		sessions, _ := svc.ListSessions(ctx, user.ID)
		for _, s := range sessions {
			if s.UserID != user.ID {
				t.Errorf("Leaked session owned by %d to user %d", s.UserID, user.ID)
			}
		}
	})

	t.Run("Logout-all revokes every session for the user", func(t *testing.T) {
		// Log in twice for user1
		req1 := &LoginRequest{
			Email:    "tester@example.com",
			Password: "password123",
			DeviceID: "device-la1",
			Platform: "web",
		}
		_, token1, _ := svc.Login(ctx, req1, "127.0.0.1", "Mozilla/5.0")

		req2 := &LoginRequest{
			Email:    "tester@example.com",
			Password: "password123",
			DeviceID: "device-la2",
			Platform: "web",
		}
		_, token2, _ := svc.Login(ctx, req2, "127.0.0.1", "Mozilla/5.0")

		// Call logout all
		err := svc.LogoutAll(ctx, user.ID)
		if err != nil {
			t.Fatalf("LogoutAll failed: %v", err)
		}

		// Verify both validations fail
		_, err = svc.ValidateSessionToken(ctx, token1)
		if err == nil {
			t.Error("Expected token1 validation to fail after LogoutAll")
		}

		_, err = svc.ValidateSessionToken(ctx, token2)
		if err == nil {
			t.Error("Expected token2 validation to fail after LogoutAll")
		}
	})
}

// TestSecurityCases covers security-specific scenarios.
func TestSecurityCases(t *testing.T) {
	ctx := context.Background()
	userRepo := NewMemoryUserRepository()
	sessionRepo := newMockSessionRepo()
	cfg := &config.Config{
		SessionCookieName:   "session_token",
		SessionCookieSecure: true,
		SessionTTL:          24 * time.Hour,
	}
	svc := NewSessionService(sessionRepo, userRepo, cfg)

	hashedPassword, _ := HashPassword("password123")
	user := &User{
		Username:     "sectest",
		Email:        "sectest@example.com",
		PasswordHash: hashedPassword,
		DisplayName:  "SecTest",
	}
	_ = userRepo.CreateUser(ctx, user)

	user2 := &User{
		Username:     "sectest2",
		Email:        "sectest2@example.com",
		PasswordHash: hashedPassword,
		DisplayName:  "SecTest2",
	}
	_ = userRepo.CreateUser(ctx, user2)

	t.Run("Login with non-existent email returns ErrInvalidCredentials not user oracle", func(t *testing.T) {
		_, _, err := svc.Login(ctx, &LoginRequest{
			Email:    "does-not-exist@example.com",
			Password: "password123",
			DeviceID: "d",
			Platform: "web",
		}, "127.0.0.1", "Mozilla/5.0")
		if err != ErrInvalidCredentials {
			t.Errorf("Expected ErrInvalidCredentials, got %v", err)
		}
	})

	t.Run("Login with wrong password returns ErrInvalidCredentials not user oracle", func(t *testing.T) {
		_, _, err := svc.Login(ctx, &LoginRequest{
			Email:    "sectest@example.com",
			Password: "wrongpassword",
			DeviceID: "d",
			Platform: "web",
		}, "127.0.0.1", "Mozilla/5.0")
		if err != ErrInvalidCredentials {
			t.Errorf("Expected ErrInvalidCredentials, got %v", err)
		}
	})

	t.Run("RevokeDevice for another user's device returns ErrDeviceNotFound", func(t *testing.T) {
		// Login as user1 to create a device
		_, _, _ = svc.Login(ctx, &LoginRequest{
			Email:    "sectest@example.com",
			Password: "password123",
			DeviceID: "user1-device",
			Platform: "web",
		}, "127.0.0.1", "Mozilla/5.0")

		devices, _ := sessionRepo.ListDevices(ctx, user.ID)
		if len(devices) == 0 {
			t.Fatal("Expected device to be created for user1")
		}
		user1DeviceID := devices[0].ID

		// Attempt revoke as user2
		err := svc.RevokeDevice(ctx, user2.ID, user1DeviceID)
		if err != ErrDeviceNotFound {
			t.Errorf("Expected ErrDeviceNotFound when cross-user revoke, got %v", err)
		}
	})

	t.Run("RevokeSession for another user's session returns ErrSessionNotFound", func(t *testing.T) {
		// Login as user1 to create a session
		_, _, _ = svc.Login(ctx, &LoginRequest{
			Email:    "sectest@example.com",
			Password: "password123",
			DeviceID: "user1-device-sess",
			Platform: "web",
		}, "127.0.0.1", "Mozilla/5.0")

		var user1SessionID int64
		for _, s := range sessionRepo.sessions {
			if s.UserID == user.ID {
				user1SessionID = s.ID
				break
			}
		}
		if user1SessionID == 0 {
			t.Fatal("Expected session to be created for user1")
		}

		// Attempt revoke as user2
		err := svc.RevokeSession(ctx, user2.ID, user1SessionID)
		if err != ErrSessionNotFound {
			t.Errorf("Expected ErrSessionNotFound when cross-user revoke, got %v", err)
		}
	})

	t.Run("Revoked device rejects further session validation", func(t *testing.T) {
		_, token, _ := svc.Login(ctx, &LoginRequest{
			Email:    "sectest@example.com",
			Password: "password123",
			DeviceID: "device-for-revoke-sec",
			Platform: "web",
		}, "127.0.0.1", "Mozilla/5.0")

		// Confirm valid before revoke
		session, err := svc.ValidateSessionToken(ctx, token)
		if err != nil {
			t.Fatalf("Expected session to be valid before device revoke: %v", err)
		}

		_ = svc.RevokeDevice(ctx, user.ID, session.DeviceID)

		_, err = svc.ValidateSessionToken(ctx, token)
		if err == nil {
			t.Error("Expected OLD session validation to fail after device was revoked")
		}
	})

	t.Run("Re-login from revoked device succeeds and reactivates it", func(t *testing.T) {
		// Ensure device exists and is revoked
		_, firstToken, _ := svc.Login(ctx, &LoginRequest{
			Email:    "sectest@example.com",
			Password: "password123",
			DeviceID: "device-reactivation-test",
			Platform: "web",
		}, "10.0.0.1", "Mozilla/5.0")

		firstSession, _ := svc.ValidateSessionToken(ctx, firstToken)
		_ = svc.RevokeDevice(ctx, user.ID, firstSession.DeviceID)

		// Old session must be invalid
		_, err := svc.ValidateSessionToken(ctx, firstToken)
		if err == nil {
			t.Fatal("Expected old session to be invalid after device revoke")
		}

		// Re-login with same device ID — must succeed
		_, newToken, err := svc.Login(ctx, &LoginRequest{
			Email:    "sectest@example.com",
			Password: "password123",
			DeviceID: "device-reactivation-test",
			Platform: "web",
		}, "10.0.0.2", "Mozilla/5.0")
		if err != nil {
			t.Fatalf("Expected re-login from revoked device to succeed, got: %v", err)
		}

		// New session must be valid
		_, err = svc.ValidateSessionToken(ctx, newToken)
		if err != nil {
			t.Errorf("Expected new session after re-login to be valid, got: %v", err)
		}
	})


	t.Run("Token generation uses crypto/rand - raw token is not the hash", func(t *testing.T) {
		svcInternal := svc.(*sessionService)
		raw, hash, err := svcInternal.generateTokenPair()
		if err != nil {
			t.Fatalf("generateTokenPair failed: %v", err)
		}
		if raw == hash {
			t.Error("Raw token must not equal its hash")
		}
		// Re-hashing the raw must reproduce the stored hash
		if svcInternal.hashToken(raw) != hash {
			t.Error("hashToken(raw) must equal the stored hash")
		}
	})

	t.Run("Sentinel errors are typed - ErrDeviceNotFound and ErrSessionNotFound are distinct", func(t *testing.T) {
		if ErrDeviceNotFound == ErrSessionNotFound {
			t.Error("ErrDeviceNotFound and ErrSessionNotFound must be distinct sentinel values")
		}
		if ErrDeviceNotFound == ErrInvalidCredentials {
			t.Error("ErrDeviceNotFound and ErrInvalidCredentials must be distinct")
		}
	})
}
