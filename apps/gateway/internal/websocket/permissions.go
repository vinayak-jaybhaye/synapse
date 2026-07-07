package websocket

import (
	"context"
	"database/sql"
	"errors"

	"github.com/lib/pq"
)

// Permission represents a bitwise permission flag.
type Permission uint64

// Core bitwise permission constants matching apps/api/internal/permissions/types.go.
// These are the bits relevant for channel viewing and administration.
const (
	ADMINISTRATOR Permission = 1 << 3  // Bit 3: Bypasses all channel role permission overrides.
	VIEW_CHANNEL  Permission = 1 << 10 // Bit 10: Controls access to viewing/joining a channel.
)

// HasPermission checks if the effective permission bitmask contains the required permission.
// The ADMINISTRATOR permission acts as an unconditional wildcard, instantly granting any permission.
func HasPermission(effective Permission, required Permission) bool {
	return effective&ADMINISTRATOR != 0 || effective&required != 0
}

// ResolveChannelAccess computes the final effective permission bitmask for a specific user in a channel.
// The computation follows standard priority rules:
//  1. Guild Owner: Instantly gets ADMINISTRATOR permission (wildcard).
//  2. Non-Guild Member: Instantly gets 0 permissions (unless it's a DM they are part of).
//  3. Base Permissions: Union (bitwise OR) of permissions from all custom roles assigned to the user,
//     plus the guild's default (@everyone) role.
//  4. Administrator Short-circuit: If the base permission has ADMINISTRATOR, the calculation returns
//     early, ignoring any channel-level role overrides.
//  5. Channel-Level Overrides: Apply default (@everyone) role overrides first (deny, then allow),
//     followed by the user's custom roles overrides (deny, then allow).
func ResolveChannelAccess(ctx context.Context, db *sql.DB, userID, channelID int64) (Permission, error) {
	// First, fetch the channel's associated guild ID.
	var guildID sql.NullInt64
	chanQuery := `SELECT guild_id FROM channels WHERE id = $1 AND deleted_at IS NULL`
	err := db.QueryRowContext(ctx, chanQuery, channelID).Scan(&guildID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// If the channel is not found in the channels table, it might be a direct conversation (DM).
			// We check direct_conversations to verify if this user is a participant.
			var exists bool
			dmQuery := `SELECT EXISTS(SELECT 1 FROM direct_conversations WHERE channel_id = $1 AND (user1_id = $2 OR user2_id = $2))`
			err = db.QueryRowContext(ctx, dmQuery, channelID, userID).Scan(&exists)
			if err == nil && exists {
				// DMs implicitly grant VIEW_CHANNEL permissions to their participants.
				return VIEW_CHANNEL, nil
			}
			return 0, nil
		}
		return 0, err
	}

	// Handle DM fallback if the channel exists in the channel table but has a null guild ID.
	if !guildID.Valid {
		var exists bool
		dmQuery := `SELECT EXISTS(SELECT 1 FROM direct_conversations WHERE channel_id = $1 AND (user1_id = $2 OR user2_id = $2))`
		err = db.QueryRowContext(ctx, dmQuery, channelID, userID).Scan(&exists)
		if err == nil && exists {
			return VIEW_CHANNEL, nil
		}
		return 0, nil
	}

	// Verify that the user is an active member of the guild.
	var isMember bool
	memberQuery := `SELECT EXISTS(SELECT 1 FROM guild_members WHERE guild_id = $1 AND user_id = $2)`
	err = db.QueryRowContext(ctx, memberQuery, guildID.Int64, userID).Scan(&isMember)
	if err != nil {
		return 0, err
	}
	if !isMember {
		return 0, nil
	}

	// Compute base permissions by fetching the default role and the user's custom roles in one SQL UNION query.
	rows, err := db.QueryContext(ctx, `
		SELECT permissions FROM roles WHERE guild_id = $1 AND is_default = TRUE
		UNION
		SELECT r.permissions
		FROM roles r
		INNER JOIN member_roles mr ON r.id = mr.role_id
		WHERE mr.guild_id = $1 AND mr.user_id = $2
	`, guildID.Int64, userID)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	// Locate the default (@everyone) role ID in this guild, as it defines the starting override priority.
	var defaultRoleID int64
	_ = db.QueryRowContext(ctx, `SELECT id FROM roles WHERE guild_id = $1 AND is_default = TRUE`, guildID.Int64).Scan(&defaultRoleID)

	// Combine all role permissions via bitwise OR.
	var mask Permission
	for rows.Next() {
		var p int64
		if err := rows.Scan(&p); err == nil {
			mask |= Permission(p)
		}
	}

	// Administrator short-circuit: Administrators bypass all channel-level overrides.
	if mask&ADMINISTRATOR != 0 {
		return mask, nil
	}

	// Collect the user's custom role IDs in this guild.
	rolesRows, err := db.QueryContext(ctx, `
		SELECT role_id FROM member_roles WHERE guild_id = $1 AND user_id = $2
	`, guildID.Int64, userID)
	userRoleIDs := make(map[int64]bool)
	if err == nil {
		defer rolesRows.Close()
		for rolesRows.Next() {
			var rid int64
			if err := rolesRows.Scan(&rid); err == nil {
				userRoleIDs[rid] = true
			}
		}
	}
	// The default role always applies to the user.
	if defaultRoleID != 0 {
		userRoleIDs[defaultRoleID] = true
	}

	// Fetch all role overrides configured for this channel.
	overrideRows, err := db.QueryContext(ctx, `
		SELECT role_id, allow_permissions, deny_permissions
		FROM channel_role_permissions
		WHERE channel_id = $1
	`, channelID)
	if err != nil {
		return mask, err
	}
	defer overrideRows.Close()

	type override struct {
		allow int64
		deny  int64
	}
	overridesMap := make(map[int64]override)
	for overrideRows.Next() {
		var rid, allow, deny int64
		if err := overrideRows.Scan(&rid, &allow, &deny); err == nil {
			overridesMap[rid] = override{allow: allow, deny: deny}
		}
	}

	// 1. Apply default (@everyone) role overrides first (deny, then allow).
	if o, ok := overridesMap[defaultRoleID]; ok {
		mask &^= Permission(o.deny) // Clear denied bits
		mask |= Permission(o.allow) // Set allowed bits
	}

	// 2. Apply user custom roles overrides. Denied/allowed bits are aggregated across all custom roles,
	// and then applied in the order of deny-then-allow.
	var rolesAllow, rolesDeny Permission
	for rid, o := range overridesMap {
		if rid != defaultRoleID && userRoleIDs[rid] {
			rolesAllow |= Permission(o.allow)
			rolesDeny |= Permission(o.deny)
		}
	}

	mask &^= rolesDeny
	mask |= rolesAllow

	return mask, nil
}

// ResolveChannelAccessBatch computes permissions for a batch of user IDs on a channel.
// Rather than performing N sequential database operations (which introduces high latency for active guilds),
// this function batches all evaluations into exactly 3 efficient, decoupled SQL queries:
//  1. Guild ID resolution for the channel
//  2. Members check & base role permissions union across all users (using PostgreSQL ANY(...) array operator)
//  3. Channel permission overrides configuration
//
// Calculation rules (short-circuiting, default role priority, custom roles ordering) remain identical to the single-user resolver.
func ResolveChannelAccessBatch(ctx context.Context, db *sql.DB, userIDs []int64, channelID int64) (map[int64]Permission, error) {
	result := make(map[int64]Permission)
	if len(userIDs) == 0 {
		return result, nil
	}

	// Query 1: Guild ID resolution
	var guildID sql.NullInt64
	chanQuery := `SELECT guild_id FROM channels WHERE id = $1 AND deleted_at IS NULL`
	err := db.QueryRowContext(ctx, chanQuery, channelID).Scan(&guildID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Check direct conversations (DMs) for participants
			var u1, u2 int64
			dmQuery := `SELECT user1_id, user2_id FROM direct_conversations WHERE channel_id = $1`
			err = db.QueryRowContext(ctx, dmQuery, channelID).Scan(&u1, &u2)
			if err == nil {
				for _, uid := range userIDs {
					if uid == u1 || uid == u2 {
						result[uid] = VIEW_CHANNEL
					}
				}
			}
			return result, nil
		}
		return nil, err
	}

	// DM fallback logic
	if !guildID.Valid {
		var u1, u2 int64
		dmQuery := `SELECT user1_id, user2_id FROM direct_conversations WHERE channel_id = $1`
		err = db.QueryRowContext(ctx, dmQuery, channelID).Scan(&u1, &u2)
		if err == nil {
			for _, uid := range userIDs {
				if uid == u1 || uid == u2 {
					result[uid] = VIEW_CHANNEL
				}
			}
		}
		return result, nil
	}

	// Query 2a: Confirm guild memberships for all users in the batch
	membersRows, err := db.QueryContext(ctx, `
		SELECT user_id FROM guild_members WHERE guild_id = $1 AND user_id = ANY($2)
	`, guildID.Int64, pq.Array(userIDs))
	if err != nil {
		return nil, err
	}
	defer membersRows.Close()

	activeMembers := make(map[int64]bool)
	for membersRows.Next() {
		var uid int64
		if err := membersRows.Scan(&uid); err == nil {
			activeMembers[uid] = true
		}
	}

	// Query 2b: Get default role details for base setup
	var defaultRoleID int64
	var defaultRolePerms int64
	err = db.QueryRowContext(ctx, `
		SELECT id, permissions FROM roles WHERE guild_id = $1 AND is_default = TRUE
	`, guildID.Int64).Scan(&defaultRoleID, &defaultRolePerms)
	if err != nil {
		return nil, err
	}

	// Query 2c: Fetch custom role permissions for members using the ANY($2) optimization
	rows, err := db.QueryContext(ctx, `
		SELECT mr.user_id, r.id, r.permissions
		FROM roles r
		INNER JOIN member_roles mr ON r.id = mr.role_id
		WHERE mr.guild_id = $1 AND mr.user_id = ANY($2)
	`, guildID.Int64, pq.Array(userIDs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	userRoles := make(map[int64][]int64)
	userPerms := make(map[int64]Permission)

	// Initialize active members in the batch with the default role permissions
	for uid := range activeMembers {
		userPerms[uid] = Permission(defaultRolePerms)
		userRoles[uid] = []int64{defaultRoleID}
	}

	// Aggregate base role lists and combine permissions via bitwise OR
	for rows.Next() {
		var uid, rid, perms int64
		if err := rows.Scan(&uid, &rid, &perms); err == nil {
			if activeMembers[uid] {
				userRoles[uid] = append(userRoles[uid], rid)
				userPerms[uid] |= Permission(perms)
			}
		}
	}

	// Query 3: Fetch all channel overrides configured for this channel
	overridesRows, err := db.QueryContext(ctx, `
		SELECT role_id, allow_permissions, deny_permissions
		FROM channel_role_permissions
		WHERE channel_id = $1
	`, channelID)
	if err != nil {
		return nil, err
	}
	defer overridesRows.Close()

	type override struct {
		allow int64
		deny  int64
	}
	overridesMap := make(map[int64]override)
	for overridesRows.Next() {
		var rid, allow, deny int64
		if err := overridesRows.Scan(&rid, &allow, &deny); err == nil {
			overridesMap[rid] = override{allow: allow, deny: deny}
		}
	}

	// Query 4: Get guild owner (executed once outside of user calculation loop)
	var ownerID int64
	_ = db.QueryRowContext(ctx, `SELECT owner_id FROM guilds WHERE id = $1`, guildID.Int64).Scan(&ownerID)

	// Evaluate permissions for each connected user in the batch
	for uid, mask := range userPerms {
		// Owner automatically gets administrator bypass
		if ownerID == uid {
			result[uid] = mask | ADMINISTRATOR
			continue
		}

		// Administrator role automatically bypasses channel overrides
		if mask&ADMINISTRATOR != 0 {
			result[uid] = mask
			continue
		}

		// Apply default (@everyone) role overrides
		if o, ok := overridesMap[defaultRoleID]; ok {
			mask &^= Permission(o.deny)
			mask |= Permission(o.allow)
		}

		// Apply custom role overrides (union allowed & denied, then deny-then-allow)
		var rolesAllow, rolesDeny Permission
		for _, rid := range userRoles[uid] {
			if rid != defaultRoleID {
				if o, ok := overridesMap[rid]; ok {
					rolesAllow |= Permission(o.allow)
					rolesDeny |= Permission(o.deny)
				}
			}
		}

		mask &^= rolesDeny
		mask |= rolesAllow

		result[uid] = mask
	}

	return result, nil
}
