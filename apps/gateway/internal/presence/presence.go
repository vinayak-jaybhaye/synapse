// Package presence provides Redis Sorted Set (ZSET) based presence tracking.
// Every user can have multiple concurrent active WebSocket connections (e.g. browser and mobile app).
// We store connection IDs as elements in a ZSET (`presence:<user_id>`) with their expiration timestamp as the score.
// If a user has at least one connection whose score is in the future, they are considered "online".
//
// NOTE: This package assumes connection IDs (connID) are caller-guaranteed to be unique (e.g., UUIDs).
// Sharing a connID across multiple sessions will result under-counting active user connections.
package presence

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	heartbeatInterval = 50 * time.Second
	ttlSeconds        = 75 // Slightly higher than 60s max heartbeat miss to allow jitter
)

// luaUpdate script purges expired connections, counts active ones, adds the current connection,
// and refreshes key TTL.
// Querying Redis TIME command internally eliminates clock-skew errors between multiple Gateway server instances.
// Returns count BEFORE adding the current connection.
var luaUpdate = redis.NewScript(`
local key = KEYS[1]
local connID = ARGV[1]
local ttl = tonumber(ARGV[2])

-- Query time from Redis server directly to avoid clock skew
local timeSlice = redis.call('TIME')
local now = tonumber(timeSlice[1])
local expiry = now + ttl

-- Purge expired connections
redis.call('ZREMRANGEBYSCORE', key, '-inf', now)
local count_before = redis.call('ZCOUNT', key, now, '+inf')

-- Register/refresh the current connection
redis.call('ZADD', key, expiry, connID)
redis.call('EXPIRE', key, ttl)

return count_before
`)

// luaRemove script removes the current connection, purges expired ones, and sets key TTL if not empty.
// Returns count AFTER removing the connection.
var luaRemove = redis.NewScript(`
local key = KEYS[1]
local connID = ARGV[1]
local ttl = tonumber(ARGV[2])

-- Query time from Redis server directly
local timeSlice = redis.call('TIME')
local now = tonumber(timeSlice[1])

-- Remove current connection
redis.call('ZREM', key, connID)
-- Clean up other expired connections
redis.call('ZREMRANGEBYSCORE', key, '-inf', now)

local count_after = redis.call('ZCOUNT', key, now, '+inf')
if count_after > 0 then
    redis.call('EXPIRE', key, ttl)
end

return count_after
`)

// MarkOnline updates the presence ZSET for a given user connection.
// Returns true if the user transitioned from offline to online (0 -> 1 active connections).
func MarkOnline(ctx context.Context, rdb *redis.Client, userID int64, connID string) (bool, error) {
	key := fmt.Sprintf("presence:%d", userID)

	countBefore, err := luaUpdate.Run(ctx, rdb, []string{key}, connID, ttlSeconds).Int()
	if err != nil {
		return false, err
	}

	return countBefore == 0, nil
}

// MarkOffline removes a user connection from the presence ZSET.
// Returns true if the user transitioned from online to offline (all active connections closed).
func MarkOffline(ctx context.Context, rdb *redis.Client, userID int64, connID string) (bool, error) {
	key := fmt.Sprintf("presence:%d", userID)

	countAfter, err := luaRemove.Run(ctx, rdb, []string{key}, connID, ttlSeconds).Int()
	if err != nil {
		return false, err
	}

	return countAfter == 0, nil
}

// IsUserOnline evaluates ZCOUNT using Redis server's current time to check if the user has
// at least one active connection.
func IsUserOnline(ctx context.Context, rdb *redis.Client, userID int64) (bool, error) {
	key := fmt.Sprintf("presence:%d", userID)

	timeSlice, err := rdb.Time(ctx).Result()
	if err != nil {
		return false, err
	}
	now := timeSlice.Unix()

	count, err := rdb.ZCount(ctx, key, fmt.Sprintf("%d", now), "+inf").Result()
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
