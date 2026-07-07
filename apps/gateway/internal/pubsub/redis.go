// Package pubsub handles the bridge between API events (transported via Redis Pub/Sub)
// and the local Gateway Hub. It listens to global events and updates local subscriptions or dispatches messages.
package pubsub

import (
	"context"
	"encoding/json"
	"log/slog"
	"strconv"
	"strings"

	"github.com/redis/go-redis/v9"
	"github.com/synapse/gateway/internal/websocket"
)

// Subscriber listens to Redis Pub/Sub using pattern subscriptions and fan-outs
// all events to connected WebSocket clients via the Hub.
type Subscriber struct {
	rdb    *redis.Client
	hub    *websocket.Hub
	pubsub *redis.PubSub
}

// New creates a new Redis Pub/Sub subscriber that listens to all channel and
// guild events using pattern subscriptions. This ensures events for newly
// created channels (e.g. DMs, voice channels) are received without requiring
// dynamic subscribe/unsubscribe calls on the Redis connection.
func New(rdb *redis.Client, hub *websocket.Hub) *Subscriber {
	// Use PSubscribe with glob patterns so we receive ALL channel:*, guild:*, and user:*
	// messages globally. The Hub's internal maps handle per-client filtering.
	ps := rdb.PSubscribe(context.Background(), "channel:*", "guild:*", "user:*")

	s := &Subscriber{
		rdb:    rdb,
		hub:    hub,
		pubsub: ps,
	}

	return s
}

// Run blocks and continuously reads from the active Redis subscriptions.
func (s *Subscriber) Run(ctx context.Context) {
	slog.Info("gateway: Redis Pub/Sub subscriber started (pattern mode: channel:*, guild:*, user:*)")

	defer s.pubsub.Close()
	ch := s.pubsub.Channel()

	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-ch:
			if msg == nil {
				continue
			}
			s.handleMessage(msg)
		}
	}
}

// handleMessage parses the Pub/Sub envelope and triggers real-time updates.
// It intercepts permission, role, and member updates to sync WebSocket client subscriptions
// on-the-fly BEFORE broadcasting the original event payload down the websocket pipelines.
func (s *Subscriber) handleMessage(msg *redis.Message) {
	// Channels are formatted as "channel:{id}" or "guild:{id}".
	parts := strings.Split(msg.Channel, ":")
	if len(parts) != 2 {
		return
	}
	aggregateID, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return
	}

	payload := []byte(msg.Payload)

	if parts[0] == "channel" {
		// Inbound channel message: intercept CHANNEL_PERMISSIONS_UPDATE events.
		var env struct {
			Type string          `json:"t"`
			Data json.RawMessage `json:"d"`
		}
		if err := json.Unmarshal(payload, &env); err == nil {
			if env.Type == "CHANNEL_PERMISSIONS_UPDATE" {
				var d struct {
					ChannelID    int64 `json:"channel_id,string"`
					GuildID      int64 `json:"guild_id,string"`
					IsRestricted bool  `json:"is_restricted"`
				}
				if err := json.Unmarshal(env.Data, &d); err == nil {
					// Update Gateway subscriptions first.
					s.hub.HandleChannelPermissionsUpdate(context.Background(), d.GuildID, d.ChannelID, d.IsRestricted)
				}
			}
		}
		// Fan out message payload to remaining channel subscribers.
		s.hub.BroadcastToChannel(aggregateID, payload)
	} else if parts[0] == "guild" {
		// Inbound guild message: intercept role and member updates.
		var env struct {
			Type string          `json:"t"`
			Data json.RawMessage `json:"d"`
		}
		if err := json.Unmarshal(payload, &env); err == nil {
			switch env.Type {
			case "GUILD_ROLE_UPDATE":
				var d struct {
					ID          int64 `json:"id,string"`
					GuildID     int64 `json:"guild_id,string"`
					Permissions int64 `json:"permissions,string"`
				}
				if err := json.Unmarshal(env.Data, &d); err == nil {
					// Check if the updated role permissions grant ADMINISTRATOR (bit 3).
					grantsAdmin := (d.Permissions & 8) != 0
					s.hub.HandleGuildRoleUpdate(context.Background(), d.GuildID, d.ID, grantsAdmin)
				}
			case "GUILD_MEMBER_UPDATE":
				var d struct {
					UserID  int64 `json:"user_id,string"`
					GuildID int64 `json:"guild_id,string"`
				}
				if err := json.Unmarshal(env.Data, &d); err == nil {
					// Update user subscriptions for the updated member roles.
					s.hub.HandleGuildMemberUpdate(context.Background(), d.GuildID, d.UserID)
				}
			case "GUILD_MEMBER_ADD":
				var d struct {
					UserID  int64 `json:"user_id,string"`
					GuildID int64 `json:"guild_id,string"`
				}
				if err := json.Unmarshal(env.Data, &d); err == nil {
					s.hub.HandleGuildMemberAdd(context.Background(), d.GuildID, d.UserID)
				}
			case "GUILD_MEMBER_REMOVE", "GUILD_BAN_ADD":
				var d struct {
					UserID  int64 `json:"user_id,string"`
					GuildID int64 `json:"guild_id,string"`
				}
				if err := json.Unmarshal(env.Data, &d); err == nil {
					s.hub.HandleGuildMemberRemove(context.Background(), d.GuildID, d.UserID)
				}
			case "CHANNEL_CREATE":
				var d struct {
					ID           int64 `json:"id,string"`
					GuildID      int64 `json:"guild_id,string"`
					IsRestricted bool  `json:"is_restricted"`
				}
				if err := json.Unmarshal(env.Data, &d); err == nil {
					// Dynamically subscribe all eligible guild members to the new channel
					s.hub.HandleChannelPermissionsUpdate(context.Background(), d.GuildID, d.ID, d.IsRestricted)
				}
			}
		}
		// Fan out message payload to guild subscribers.
		s.hub.BroadcastToGuild(aggregateID, payload)
	} else if parts[0] == "user" {
		var env struct {
			Type string          `json:"t"`
			Data json.RawMessage `json:"d"`
		}
		if err := json.Unmarshal(payload, &env); err == nil {
			switch env.Type {
			case "USER_DM_CREATE":
				var d struct {
					ChannelID int64 `json:"channel_id,string"`
					User1ID   int64 `json:"user1_id,string"`
					User2ID   int64 `json:"user2_id,string"`
				}
				if err := json.Unmarshal(env.Data, &d); err == nil {
					s.hub.HandleUserDMCreate(context.Background(), d.ChannelID, d.User1ID, d.User2ID)
					slog.Info("gateway: handled USER_DM_CREATE", "channelID", d.ChannelID)
				} else {
					slog.Error("gateway: failed to unmarshal USER_DM_CREATE data", "err", err, "data", string(env.Data))
				}
			}
		} else {
			slog.Error("gateway: failed to unmarshal user event envelope", "err", err, "payload", string(payload))
		}
		// Fan out to specific user subscribers.
		s.hub.BroadcastToUser(aggregateID, payload)
	}
}
