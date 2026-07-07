// Package auth handles user session validation for WebSocket connections.
package auth

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"time"
)

// ValidateSession validates the client's token when they connect to the gateway.
func ValidateSession(ctx context.Context, db *sql.DB, token string) (int64, error) {
	// 1. Hash the incoming token
	// Session tokens are stored in the database as SHA-256 hashes for security.
	// We hash the incoming token so we can query the matching database record.
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	// 2. Retrieve session and device status
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

	// 3. Validation checks
	if revokedAt != nil {
		return 0, errors.New("session revoked")
	}
	if time.Now().After(expiresAt) {
		return 0, errors.New("session expired")
	}
	if deviceStatus == "REVOKED" {
		return 0, errors.New("device revoked")
	}

	// 4. Update session and device activity timestamps in the database
	// To prevent writing to the database on every reconnect attempt if a client is
	// rapidly reconnecting, we only write the update if the stored activity is older
	// than 5 minutes (enforced by the conditional WHERE clause).
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
