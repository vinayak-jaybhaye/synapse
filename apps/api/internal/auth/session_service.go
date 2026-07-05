package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/synapse/api/internal/config"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrDeviceNotFound     = errors.New("device not found")
	ErrSessionNotFound    = errors.New("session not found")
)

// dummyHash is a bcrypt hash of "dummy" used to prevent user-enumeration
// via timing differences when the email doesn't exist.
const dummyHash = "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi"

type SessionService interface {
	Register(ctx context.Context, req *RegisterRequest, ipAddress string, userAgent string) (*AuthResponse, string, error)
	Login(ctx context.Context, req *LoginRequest, ipAddress string, userAgent string) (*AuthResponse, string, error)
	ValidateSessionToken(ctx context.Context, token string) (*Session, error)

	ListDevices(ctx context.Context, userID int64) ([]Device, error)
	ListSessions(ctx context.Context, userID int64) ([]SessionResponse, error)
	RevokeDevice(ctx context.Context, userID, deviceID int64) error
	RevokeSession(ctx context.Context, userID, sessionID int64) error
	Logout(ctx context.Context, token string) error
	LogoutAll(ctx context.Context, userID int64) error

	CleanupExpired(ctx context.Context) (int64, error)
}

type sessionService struct {
	sessionRepo SessionRepository
	userRepo    UserRepository
	cfg         *config.Config
}

func NewSessionService(sessionRepo SessionRepository, userRepo UserRepository, cfg *config.Config) SessionService {
	return &sessionService{
		sessionRepo: sessionRepo,
		userRepo:    userRepo,
		cfg:         cfg,
	}
}

func (s *sessionService) Register(ctx context.Context, req *RegisterRequest, ipAddress string, userAgent string) (*AuthResponse, string, error) {
	hashedPassword, err := HashPassword(req.Password)
	if err != nil {
		return nil, "", err
	}

	user := &User{
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: hashedPassword,
		DisplayName:  req.Username,
	}

	if err := s.userRepo.CreateUser(ctx, user); err != nil {
		return nil, "", err
	}

	// 1. Determine device name
	deviceName := s.deriveDeviceName(req.DeviceName, userAgent)

	// 2. Upsert device
	device := &Device{
		UserID:     user.ID,
		DeviceID:   req.DeviceID,
		DeviceName: deviceName,
		Platform:   req.Platform,
		PushToken:  req.PushToken,
	}
	if err := s.sessionRepo.UpsertDevice(ctx, device); err != nil {
		return nil, "", err
	}

	// 3. Create Session
	rawToken, tokenHash, err := s.generateTokenPair()
	if err != nil {
		return nil, "", err
	}

	sessionTTL := 30 * 24 * time.Hour
	if s.cfg.SessionTTL > 0 {
		sessionTTL = s.cfg.SessionTTL
	}

	var ipPtr *string
	if ipAddress != "" {
		ipPtr = &ipAddress
	}

	session := &Session{
		UserID:    user.ID,
		DeviceID:  device.ID,
		TokenHash: tokenHash,
		IPAddress: ipPtr,
		ExpiresAt: time.Now().Add(sessionTTL),
	}
	if err := s.sessionRepo.CreateSession(ctx, session); err != nil {
		return nil, "", err
	}

	return &AuthResponse{
		User: UserDTO{
			ID:          user.ID,
			Username:    user.Username,
			DisplayName: user.DisplayName,
			Email:       user.Email,
		},
	}, rawToken, nil
}

func (s *sessionService) Login(ctx context.Context, req *LoginRequest, ipAddress string, userAgent string) (*AuthResponse, string, error) {
	user, err := s.userRepo.GetUserByEmail(ctx, req.Email)
	if err != nil || user == nil {
		// Always run bcrypt to prevent user-enumeration via timing difference.
		CheckPasswordHash(req.Password, dummyHash)
		return nil, "", ErrInvalidCredentials
	}

	if !CheckPasswordHash(req.Password, user.PasswordHash) {
		return nil, "", ErrInvalidCredentials
	}

	// 1. Determine device name
	deviceName := s.deriveDeviceName(req.DeviceName, userAgent)

	// 2. Upsert device
	device := &Device{
		UserID:     user.ID,
		DeviceID:   req.DeviceID,
		DeviceName: deviceName,
		Platform:   req.Platform,
		PushToken:  req.PushToken,
	}
	if err := s.sessionRepo.UpsertDevice(ctx, device); err != nil {
		return nil, "", fmt.Errorf("device registration failed: %w", err)
	}

	// 3. Create Session
	rawToken, tokenHash, err := s.generateTokenPair()
	if err != nil {
		return nil, "", err
	}

	sessionTTL := 30 * 24 * time.Hour
	if s.cfg.SessionTTL > 0 {
		sessionTTL = s.cfg.SessionTTL
	}

	var ipPtr *string
	if ipAddress != "" {
		ipPtr = &ipAddress
	}

	session := &Session{
		UserID:    user.ID,
		DeviceID:  device.ID,
		TokenHash: tokenHash,
		IPAddress: ipPtr,
		ExpiresAt: time.Now().Add(sessionTTL),
	}
	if err := s.sessionRepo.CreateSession(ctx, session); err != nil {
		return nil, "", err
	}

	return &AuthResponse{
		User: UserDTO{
			ID:          user.ID,
			Username:    user.Username,
			DisplayName: user.DisplayName,
			AvatarKey:   user.AvatarKey,
			Email:       user.Email,
		},
	}, rawToken, nil
}

func (s *sessionService) ValidateSessionToken(ctx context.Context, token string) (*Session, error) {
	tokenHash := s.hashToken(token)

	session, err := s.sessionRepo.GetSessionByHash(ctx, tokenHash)
	if err != nil {
		return nil, err
	}
	if session == nil {
		return nil, errors.New("session not found")
	}

	// Verify expiration
	if time.Now().After(session.ExpiresAt) {
		return nil, errors.New("session expired")
	}

	// Verify revoked state
	if session.RevokedAt != nil {
		return nil, errors.New("session revoked")
	}

	// Verify parent device revoked status
	device, err := s.sessionRepo.GetDeviceByID(ctx, session.DeviceID)
	if err != nil {
		return nil, err
	}
	if device == nil {
		return nil, errors.New("device not found")
	}
	if device.Status == "REVOKED" {
		return nil, errors.New("device revoked")
	}

	// Update last_used_at / last_seen_at with throttling (5 mins)
	now := time.Now()
	if now.Sub(session.LastUsedAt) > 5*time.Minute {
		_ = s.sessionRepo.UpdateSessionActivity(ctx, session.ID, now)
		session.LastUsedAt = now
	}
	if now.Sub(device.LastSeenAt) > 5*time.Minute {
		_ = s.sessionRepo.UpdateDeviceActivity(ctx, device.ID, now)
	}

	return session, nil
}

func (s *sessionService) ListDevices(ctx context.Context, userID int64) ([]Device, error) {
	return s.sessionRepo.ListDevices(ctx, userID)
}

func (s *sessionService) ListSessions(ctx context.Context, userID int64) ([]SessionResponse, error) {
	return s.sessionRepo.ListSessions(ctx, userID)
}

func (s *sessionService) RevokeDevice(ctx context.Context, userID, deviceID int64) error {
	err := s.sessionRepo.RevokeDevice(ctx, userID, deviceID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrDeviceNotFound
		}
		return err
	}
	return nil
}

func (s *sessionService) RevokeSession(ctx context.Context, userID, sessionID int64) error {
	err := s.sessionRepo.RevokeSession(ctx, userID, sessionID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrSessionNotFound
		}
		return err
	}
	return nil
}

func (s *sessionService) Logout(ctx context.Context, token string) error {
	tokenHash := s.hashToken(token)
	session, err := s.sessionRepo.GetSessionByHash(ctx, tokenHash)
	if err != nil {
		return err
	}
	if session == nil {
		return nil // already not found/logged out
	}
	return s.sessionRepo.RevokeSession(ctx, session.UserID, session.ID)
}

func (s *sessionService) LogoutAll(ctx context.Context, userID int64) error {
	return s.sessionRepo.RevokeAllSessions(ctx, userID)
}

func (s *sessionService) CleanupExpired(ctx context.Context) (int64, error) {
	// Clean up sessions older than 30 days after expiry
	return s.sessionRepo.CleanupExpiredSessions(ctx, 30*24*time.Hour)
}

// Helpers
func (s *sessionService) deriveDeviceName(customName *string, ua string) string {
	if customName != nil && *customName != "" {
		return *customName
	}
	if ua == "" {
		return "Web Client (Unknown)"
	}

	if strings.Contains(ua, "iPhone") {
		return "iPhone Client"
	}
	if strings.Contains(ua, "iPad") {
		return "iPad Client"
	}
	if strings.Contains(ua, "Android") {
		return "Android Client"
	}
	if strings.Contains(ua, "Windows") {
		return "Web on Windows"
	}
	if strings.Contains(ua, "Macintosh") {
		return "Web on macOS"
	}
	if strings.Contains(ua, "Linux") {
		return "Web on Linux"
	}
	return "Web Client (Unknown)"
}

func (s *sessionService) generateTokenPair() (string, string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", fmt.Errorf("failed to generate random bytes: %w", err)
	}
	rawToken := hex.EncodeToString(b)
	tokenHash := s.hashToken(rawToken)
	return rawToken, tokenHash, nil
}

func (s *sessionService) hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
