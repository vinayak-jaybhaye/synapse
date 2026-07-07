package auth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/synapse/api/internal/snowflake"
)

type pgSessionRepository struct {
	db *sql.DB
}

func NewPGSessionRepository(db *sql.DB) SessionRepository {
	return &pgSessionRepository{db: db}
}

func (r *pgSessionRepository) UpsertDevice(ctx context.Context, d *Device) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin upsert device transaction: %w", err)
	}
	defer tx.Rollback()

	// 1. Check if device already exists for user
	var existing Device
	var pushToken sql.NullString
	var revokedAt sql.NullTime

	query := `
		SELECT id, user_id, device_id, device_name, platform, push_token, is_trusted, status, first_seen_at, last_seen_at, revoked_at
		FROM devices
		WHERE user_id = $1 AND device_id = $2
	`
	err = tx.QueryRowContext(ctx, query, d.UserID, d.DeviceID).Scan(
		&existing.ID, &existing.UserID, &existing.DeviceID, &existing.DeviceName, &existing.Platform,
		&pushToken, &existing.IsTrusted, &existing.Status, &existing.FirstSeenAt, &existing.LastSeenAt, &revokedAt,
	)

	if err == nil {
		// Device exists — re-activate if it was previously revoked.
		// Revoking is session-level: it terminates active sessions, but a user who
		// authenticates again with valid credentials should always be able to log back in.
		var updateQuery string
		var inputPushToken sql.NullString
		if d.PushToken != nil {
			inputPushToken = sql.NullString{String: *d.PushToken, Valid: true}
		}

		if existing.Status == "REVOKED" {
			// Re-activate: clear revoked_at, reset status to ACTIVE, refresh timestamps/name.
			updateQuery = `
				UPDATE devices
				SET status = 'ACTIVE',
				    revoked_at = NULL,
				    last_seen_at = NOW(),
				    device_name = $1,
				    platform = $2,
				    push_token = COALESCE($3, push_token)
				WHERE id = $4
			`
		} else {
			// Normal refresh of mutable metadata.
			updateQuery = `
				UPDATE devices
				SET last_seen_at = NOW(),
				    device_name = $1,
				    platform = $2,
				    push_token = COALESCE($3, push_token)
				WHERE id = $4
			`
		}

		_, err = tx.ExecContext(ctx, updateQuery, d.DeviceName, d.Platform, inputPushToken, existing.ID)
		if err != nil {
			return fmt.Errorf("failed to update existing device: %w", err)
		}

		d.ID = existing.ID
		d.IsTrusted = existing.IsTrusted
		d.Status = "ACTIVE"
		d.FirstSeenAt = existing.FirstSeenAt
		d.LastSeenAt = time.Now()
		if pushToken.Valid {
			d.PushToken = &pushToken.String
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("failed to commit update device transaction: %w", err)
		}
		return nil
	}

	if !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("failed to check existing device: %w", err)
	}

	// 2. Insert new device
	d.ID = snowflake.GenerateID()
	d.FirstSeenAt = time.Now()
	d.LastSeenAt = time.Now()
	d.Status = "ACTIVE"
	d.IsTrusted = false

	var inputPushToken sql.NullString
	if d.PushToken != nil {
		inputPushToken = sql.NullString{String: *d.PushToken, Valid: true}
	}

	insertQuery := `
		INSERT INTO devices (id, user_id, device_id, device_name, platform, push_token, is_trusted, status, first_seen_at, last_seen_at, revoked_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL)
	`
	_, err = tx.ExecContext(ctx, insertQuery, d.ID, d.UserID, d.DeviceID, d.DeviceName, d.Platform, inputPushToken, d.IsTrusted, d.Status, d.FirstSeenAt, d.LastSeenAt)
	if err != nil {
		return fmt.Errorf("failed to insert new device: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit insert device transaction: %w", err)
	}
	return nil
}

func (r *pgSessionRepository) GetDevice(ctx context.Context, userID int64, deviceID string) (*Device, error) {
	query := `
		SELECT id, user_id, device_id, device_name, platform, push_token, is_trusted, status, first_seen_at, last_seen_at, revoked_at
		FROM devices
		WHERE user_id = $1 AND device_id = $2
	`
	var d Device
	var pushToken sql.NullString
	var revokedAt sql.NullTime

	err := r.db.QueryRowContext(ctx, query, userID, deviceID).Scan(
		&d.ID, &d.UserID, &d.DeviceID, &d.DeviceName, &d.Platform,
		&pushToken, &d.IsTrusted, &d.Status, &d.FirstSeenAt, &d.LastSeenAt, &revokedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if pushToken.Valid {
		d.PushToken = &pushToken.String
	}
	if revokedAt.Valid {
		d.RevokedAt = &revokedAt.Time
	}
	return &d, nil
}

func (r *pgSessionRepository) GetDeviceByID(ctx context.Context, id int64) (*Device, error) {
	query := `
		SELECT id, user_id, device_id, device_name, platform, push_token, is_trusted, status, first_seen_at, last_seen_at, revoked_at
		FROM devices
		WHERE id = $1
	`
	var d Device
	var pushToken sql.NullString
	var revokedAt sql.NullTime

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&d.ID, &d.UserID, &d.DeviceID, &d.DeviceName, &d.Platform,
		&pushToken, &d.IsTrusted, &d.Status, &d.FirstSeenAt, &d.LastSeenAt, &revokedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if pushToken.Valid {
		d.PushToken = &pushToken.String
	}
	if revokedAt.Valid {
		d.RevokedAt = &revokedAt.Time
	}
	return &d, nil
}

func (r *pgSessionRepository) ListDevices(ctx context.Context, userID int64) ([]Device, error) {
	query := `
		SELECT id, user_id, device_id, device_name, platform, push_token, is_trusted, status, first_seen_at, last_seen_at, revoked_at
		FROM devices
		WHERE user_id = $1
		ORDER BY last_seen_at DESC
	`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var devices []Device
	for rows.Next() {
		var d Device
		var pushToken sql.NullString
		var revokedAt sql.NullTime
		err := rows.Scan(
			&d.ID, &d.UserID, &d.DeviceID, &d.DeviceName, &d.Platform,
			&pushToken, &d.IsTrusted, &d.Status, &d.FirstSeenAt, &d.LastSeenAt, &revokedAt,
		)
		if err != nil {
			return nil, err
		}
		if pushToken.Valid {
			d.PushToken = &pushToken.String
		}
		if revokedAt.Valid {
			d.RevokedAt = &revokedAt.Time
		}
		devices = append(devices, d)
	}
	return devices, nil
}

func (r *pgSessionRepository) RevokeDevice(ctx context.Context, userID int64, deviceID int64) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Update device status
	res, err := tx.ExecContext(ctx, `
		UPDATE devices
		SET status = 'REVOKED', revoked_at = NOW()
		WHERE id = $1 AND user_id = $2 AND status != 'REVOKED'
	`, deviceID, userID)
	if err != nil {
		return err
	}

	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		// Check if it already exists but is revoked, or if it doesn't belong to the user
		var exists bool
		err := tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM devices WHERE id = $1 AND user_id = $2)", deviceID, userID).Scan(&exists)
		if err != nil {
			return err
		}
		if !exists {
			return sql.ErrNoRows
		}
		// If it's already revoked, we still proceed to clean up sessions
	}

	// Cascade revoke active sessions
	_, err = tx.ExecContext(ctx, `
		UPDATE sessions
		SET revoked_at = NOW()
		WHERE device_id = $1 AND user_id = $2 AND revoked_at IS NULL
	`, deviceID, userID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *pgSessionRepository) CreateSession(ctx context.Context, s *Session) error {
	s.ID = snowflake.GenerateID()
	s.CreatedAt = time.Now()
	s.LastUsedAt = time.Now()

	var ip sql.NullString
	if s.IPAddress != nil {
		ip = sql.NullString{String: *s.IPAddress, Valid: true}
	}

	// Derive user_id from the devices row rather than trusting the caller-supplied value.
	// This prevents sessions.user_id from ever diverging from devices.user_id.
	// RETURNING user_id writes the authoritative value back into the struct.
	query := `
		INSERT INTO sessions (id, user_id, device_id, token_hash, ip_address, created_at, last_used_at, expires_at, revoked_at)
		SELECT $1, d.user_id, $2, $3, $4, $5, $6, $7, NULL
		FROM devices d
		WHERE d.id = $2
		RETURNING user_id
	`
	err := r.db.QueryRowContext(ctx, query,
		s.ID, s.DeviceID, s.TokenHash, ip, s.CreatedAt, s.LastUsedAt, s.ExpiresAt,
	).Scan(&s.UserID)
	if errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("device %d not found when creating session", s.DeviceID)
	}
	return err
}

func (r *pgSessionRepository) GetSessionByHash(ctx context.Context, tokenHash string) (*Session, error) {
	query := `
		SELECT id, user_id, device_id, token_hash, ip_address, created_at, last_used_at, expires_at, revoked_at
		FROM sessions
		WHERE token_hash = $1
	`
	var s Session
	var ip sql.NullString
	var revokedAt sql.NullTime

	err := r.db.QueryRowContext(ctx, query, tokenHash).Scan(
		&s.ID, &s.UserID, &s.DeviceID, &s.TokenHash, &ip, &s.CreatedAt, &s.LastUsedAt, &s.ExpiresAt, &revokedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if ip.Valid {
		s.IPAddress = &ip.String
	}
	if revokedAt.Valid {
		s.RevokedAt = &revokedAt.Time
	}
	return &s, nil
}

func (r *pgSessionRepository) GetSessionByID(ctx context.Context, id int64) (*Session, error) {
	query := `
		SELECT id, user_id, device_id, token_hash, ip_address, created_at, last_used_at, expires_at, revoked_at
		FROM sessions
		WHERE id = $1
	`
	var s Session
	var ip sql.NullString
	var revokedAt sql.NullTime

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&s.ID, &s.UserID, &s.DeviceID, &s.TokenHash, &ip, &s.CreatedAt, &s.LastUsedAt, &s.ExpiresAt, &revokedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if ip.Valid {
		s.IPAddress = &ip.String
	}
	if revokedAt.Valid {
		s.RevokedAt = &revokedAt.Time
	}
	return &s, nil
}

func (r *pgSessionRepository) ListSessions(ctx context.Context, userID int64) ([]SessionResponse, error) {
	query := `
		SELECT s.id, s.user_id, s.device_id, s.ip_address, s.created_at, s.last_used_at, s.expires_at, s.revoked_at,
		       d.id, d.user_id, d.device_id, d.device_name, d.platform, d.push_token, d.is_trusted, d.status, d.first_seen_at, d.last_seen_at
		FROM sessions s
		INNER JOIN devices d ON s.device_id = d.id
		WHERE s.user_id = $1
		ORDER BY s.last_used_at DESC
	`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []SessionResponse
	for rows.Next() {
		var s SessionResponse
		var ip sql.NullString
		var sRevokedAt sql.NullTime

		var d DeviceResponse
		var dPushToken sql.NullString

		err := rows.Scan(
			&s.ID, &s.UserID, &s.DeviceID, &ip, &s.CreatedAt, &s.LastUsedAt, &s.ExpiresAt, &sRevokedAt,
			&d.ID, &d.UserID, &d.DeviceID, &d.DeviceName, &d.Platform, &dPushToken, &d.IsTrusted, &d.Status, &d.FirstSeenAt, &d.LastSeenAt,
		)
		if err != nil {
			return nil, err
		}

		if ip.Valid {
			s.IPAddress = &ip.String
		}
		if sRevokedAt.Valid {
			s.RevokedAt = &sRevokedAt.Time
		}

		if dPushToken.Valid {
			d.PushToken = &dPushToken.String
		}

		// Derive session status
		now := time.Now()
		if s.RevokedAt != nil {
			s.Status = "REVOKED"
		} else if s.ExpiresAt.Before(now) {
			s.Status = "EXPIRED"
		} else {
			s.Status = "ACTIVE"
		}

		s.Device = &d
		sessions = append(sessions, s)
	}
	return sessions, nil
}

func (r *pgSessionRepository) RevokeSession(ctx context.Context, userID int64, sessionID int64) error {
	res, err := r.db.ExecContext(ctx, `
		UPDATE sessions
		SET revoked_at = NOW()
		WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
	`, sessionID, userID)
	if err != nil {
		return err
	}

	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		var exists bool
		err := r.db.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM sessions WHERE id = $1 AND user_id = $2)", sessionID, userID).Scan(&exists)
		if err != nil {
			return err
		}
		if !exists {
			return sql.ErrNoRows
		}
	}
	return nil
}

func (r *pgSessionRepository) RevokeAllSessions(ctx context.Context, userID int64) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE sessions
		SET revoked_at = NOW()
		WHERE user_id = $1 AND revoked_at IS NULL
	`, userID)
	return err
}

func (r *pgSessionRepository) UpdateSessionActivity(ctx context.Context, sessionID int64, lastUsedAt time.Time) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE sessions
		SET last_used_at = $1
		WHERE id = $2
	`, lastUsedAt, sessionID)
	return err
}

func (r *pgSessionRepository) UpdateDeviceActivity(ctx context.Context, deviceID int64, lastSeenAt time.Time) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE devices
		SET last_seen_at = $1
		WHERE id = $2
	`, lastSeenAt, deviceID)
	return err
}

func (r *pgSessionRepository) CleanupExpiredSessions(ctx context.Context, gracePeriod time.Duration) (int64, error) {
	threshold := time.Now().Add(-gracePeriod)
	res, err := r.db.ExecContext(ctx, `
		DELETE FROM sessions
		WHERE expires_at < $1
	`, threshold)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}
