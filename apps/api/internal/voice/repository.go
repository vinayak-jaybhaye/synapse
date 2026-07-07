package voice

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	voiceStateKeyFmt  = "voice:guild:%d:user:%d"
	channelMembersKey = "voice:guild:%d:channel:%d"
)

// Repository defines the Redis-backed voice state store.
type Repository interface {
	UpsertVoiceState(ctx context.Context, state *VoiceState) error
	GetVoiceState(ctx context.Context, guildID, userID int64) (*VoiceState, error)
	DeleteVoiceState(ctx context.Context, guildID, userID int64, channelID int64) error
	ListChannelVoiceStates(ctx context.Context, guildID, channelID int64) ([]VoiceState, error)
	MoveVoiceState(ctx context.Context, guildID, userID, srcChannelID, dstChannelID int64) error
}

type redisRepository struct {
	rdb *redis.Client
}

// NewRepository creates a new Redis-backed voice state repository.
func NewRepository(rdb *redis.Client) Repository {
	return &redisRepository{rdb: rdb}
}

func voiceStateKey(guildID, userID int64) string {
	return fmt.Sprintf(voiceStateKeyFmt, guildID, userID)
}

func channelMembersSetKey(guildID, channelID int64) string {
	return fmt.Sprintf(channelMembersKey, guildID, channelID)
}

// UpsertVoiceState persists a VoiceState as a Redis hash and adds the user
// to the channel member set.
func (r *redisRepository) UpsertVoiceState(ctx context.Context, state *VoiceState) error {
	key := voiceStateKey(state.GuildID, state.UserID)

	fields := map[string]any{
		"user_id":      strconv.FormatInt(state.UserID, 10),
		"channel_id":   strconv.FormatInt(state.ChannelID, 10),
		"guild_id":     strconv.FormatInt(state.GuildID, 10),
		"self_mute":    boolStr(state.SelfMute),
		"self_deaf":    boolStr(state.SelfDeaf),
		"server_mute":  boolStr(state.ServerMute),
		"server_deaf":  boolStr(state.ServerDeaf),
		"video":        boolStr(state.Video),
		"screen_share": boolStr(state.ScreenShare),
		"joined_at":    state.JoinedAt.Format(time.RFC3339Nano),
	}

	pipe := r.rdb.Pipeline()
	pipe.HSet(ctx, key, fields)
	pipe.SAdd(ctx, channelMembersSetKey(state.GuildID, state.ChannelID), strconv.FormatInt(state.UserID, 10))
	_, err := pipe.Exec(ctx)
	if err != nil {
		return err
	}

	// Publish to Redis Pub/Sub channel "guild:{guildID}" for real-time gateway propagation
	b, _ := json.Marshal(map[string]any{
		"op": "DISPATCH",
		"t":  "VOICE_STATE_UPDATE",
		"d": map[string]any{
			"action":   "update",
			"guild_id": strconv.FormatInt(state.GuildID, 10),
			"state":    state,
		},
	})
	channel := fmt.Sprintf("guild:%d", state.GuildID)
	_ = r.rdb.Publish(ctx, channel, string(b)).Err()

	return nil
}

// GetVoiceState fetches a single user's voice state hash from Redis.
func (r *redisRepository) GetVoiceState(ctx context.Context, guildID, userID int64) (*VoiceState, error) {
	key := voiceStateKey(guildID, userID)
	vals, err := r.rdb.HGetAll(ctx, key).Result()
	if err != nil {
		return nil, err
	}
	if len(vals) == 0 {
		return nil, nil
	}
	return unmarshalVoiceState(vals)
}

// DeleteVoiceState removes the voice state hash, removes the user from the channel member set,
// and deletes the channel member set key if it becomes empty.
func (r *redisRepository) DeleteVoiceState(ctx context.Context, guildID, userID int64, channelID int64) error {
	key := voiceStateKey(guildID, userID)
	memberKey := channelMembersSetKey(guildID, channelID)
	userIDStr := strconv.FormatInt(userID, 10)

	pipe := r.rdb.Pipeline()
	pipe.Del(ctx, key)
	pipe.SRem(ctx, memberKey, userIDStr)
	_, err := pipe.Exec(ctx)
	if err != nil {
		return err
	}

	card, err := r.rdb.SCard(ctx, memberKey).Result()
	if err == nil && card == 0 {
		_ = r.rdb.Del(ctx, memberKey)
	}

	// Publish to Redis Pub/Sub channel "guild:{guildID}" for real-time gateway propagation of the leave event
	b, _ := json.Marshal(map[string]any{
		"op": "DISPATCH",
		"t":  "VOICE_STATE_UPDATE",
		"d": map[string]any{
			"action":   "leave",
			"guild_id": strconv.FormatInt(guildID, 10),
			"state": map[string]any{
				"user_id":    strconv.FormatInt(userID, 10),
				"channel_id": strconv.FormatInt(channelID, 10),
				"guild_id":   strconv.FormatInt(guildID, 10),
			},
		},
	})
	channel := fmt.Sprintf("guild:%d", guildID)
	_ = r.rdb.Publish(ctx, channel, string(b)).Err()

	return nil
}

// ListChannelVoiceStates returns all voice states for users currently in the given channel.
// Missing voice states are skipped without mutating Redis.
func (r *redisRepository) ListChannelVoiceStates(ctx context.Context, guildID, channelID int64) ([]VoiceState, error) {
	memberIDs, err := r.rdb.SMembers(ctx, channelMembersSetKey(guildID, channelID)).Result()
	if err != nil {
		return nil, err
	}

	var states []VoiceState
	for _, idStr := range memberIDs {
		uid, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			continue
		}
		state, err := r.GetVoiceState(ctx, guildID, uid)
		if err != nil {
			continue
		}
		if state == nil {
			// Skip and preserve key without silent mutations
			continue
		}
		states = append(states, *state)
	}
	return states, nil
}

// MoveVoiceState atomically moves a user between voice channels and cleans up empty sets.
func (r *redisRepository) MoveVoiceState(ctx context.Context, guildID, userID, srcChannelID, dstChannelID int64) error {
	key := voiceStateKey(guildID, userID)
	srcMemberKey := channelMembersSetKey(guildID, srcChannelID)
	dstMemberKey := channelMembersSetKey(guildID, dstChannelID)
	userIDStr := strconv.FormatInt(userID, 10)

	pipe := r.rdb.Pipeline()
	pipe.SRem(ctx, srcMemberKey, userIDStr)
	pipe.SAdd(ctx, dstMemberKey, userIDStr)
	pipe.HSet(ctx, key, "channel_id", strconv.FormatInt(dstChannelID, 10))
	_, err := pipe.Exec(ctx)
	if err != nil {
		return err
	}

	card, err := r.rdb.SCard(ctx, srcMemberKey).Result()
	if err == nil && card == 0 {
		_ = r.rdb.Del(ctx, srcMemberKey)
	}

	return nil
}

// HELPERS

func boolStr(b bool) string {
	if b {
		return "1"
	}
	return "0"
}

func parseBool(s string) bool {
	return s == "1" || s == "true"
}

func unmarshalVoiceState(m map[string]string) (*VoiceState, error) {
	uid, _ := strconv.ParseInt(m["user_id"], 10, 64)
	cid, _ := strconv.ParseInt(m["channel_id"], 10, 64)
	gid, _ := strconv.ParseInt(m["guild_id"], 10, 64)
	joinedAt, _ := time.Parse(time.RFC3339Nano, m["joined_at"])

	return &VoiceState{
		UserID:      uid,
		ChannelID:   cid,
		GuildID:     gid,
		SelfMute:    parseBool(m["self_mute"]),
		SelfDeaf:    parseBool(m["self_deaf"]),
		ServerMute:  parseBool(m["server_mute"]),
		ServerDeaf:  parseBool(m["server_deaf"]),
		Video:       parseBool(m["video"]),
		ScreenShare: parseBool(m["screen_share"]),
		JoinedAt:    joinedAt,
	}, nil
}
