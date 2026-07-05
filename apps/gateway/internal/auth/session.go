package auth

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"time"
)

// ValidateSession hashes the incoming token, checks the Postgres database,
// and returns the user_id if valid.
func ValidateSession(ctx context.Context, db *sql.DB, token string) (int64, error) {
	// 1. Hash the token
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	// 2. Query Postgres
	query := `
		SELECT s.user_id, s.expires_at, s.revoked_at, d.status
		FROM sessions s
		INNER JOIN devices d ON s.device_id = d.id
		WHERE s.token_hash = $1
	`
	var userID int64
	var expiresAt time.Time
	var revokedAt *time.Time
	var deviceStatus string

	err := db.QueryRowContext(ctx, query, tokenHash).Scan(&userID, &expiresAt, &revokedAt, &deviceStatus)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, errors.New("session not found")
		}
		return 0, err
	}

	// 3. Verify logic
	if revokedAt != nil {
		return 0, errors.New("session revoked")
	}
	if time.Now().After(expiresAt) {
		return 0, errors.New("session expired")
	}
	if deviceStatus == "REVOKED" {
		return 0, errors.New("device revoked")
	}

	// 4. Update last_used_at / last_seen_at with throttling (5 mins)
	// For simplicity, we directly perform a non-blocking throttled update here.
	_, _ = db.ExecContext(ctx, `
		UPDATE sessions
		SET last_used_at = NOW()
		WHERE token_hash = $1 AND last_used_at < NOW() - INTERVAL '5 minutes'
	`, tokenHash)

	_, _ = db.ExecContext(ctx, `
		UPDATE devices
		SET last_seen_at = NOW()
		WHERE id = (SELECT device_id FROM sessions WHERE token_hash = $1) AND last_seen_at < NOW() - INTERVAL '5 minutes'
	`, tokenHash)

	return userID, nil
}
