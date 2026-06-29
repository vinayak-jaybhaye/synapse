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

// Subscriber listens on Redis pub/sub channels matching "guild:*" and fan-outs
// all events to connected WebSocket clients via the Hub.
type Subscriber struct {
	rdb *redis.Client
	hub *websocket.Hub
}

// New creates a new Redis pub/sub subscriber.
func New(rdb *redis.Client, hub *websocket.Hub) *Subscriber {
	return &Subscriber{rdb: rdb, hub: hub}
}

// Run blocks and continuously subscribes to the "guild:*" pattern channel.
// Should be called in a goroutine.
func (s *Subscriber) Run(ctx context.Context) {
	pubsub := s.rdb.PSubscribe(ctx, "guild:*")
	defer pubsub.Close()

	slog.Info("gateway: Redis pub/sub subscriber started, listening on guild:*")

	ch := pubsub.Channel()
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			s.dispatch(msg)
		}
	}
}

// dispatch parses the Redis channel name, extracts the guildID, wraps the payload
// in a WebSocket envelope, and broadcasts to all clients subscribed to that guild.
func (s *Subscriber) dispatch(msg *redis.Message) {
	// Channel format: "guild:{guildID}"
	parts := strings.SplitN(msg.Channel, ":", 2)
	if len(parts) != 2 {
		return
	}
	guildID, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return
	}

	// Wrap the payload in a VOICE_STATE_UPDATE envelope so the client
	// knows how to route it. The inner payload is already a VoiceStateEvent JSON.
	// We decode it to determine the event type dynamically.
	var innerEvent struct {
		Action string `json:"action"`
	}
	if err := json.Unmarshal([]byte(msg.Payload), &innerEvent); err != nil {
		slog.Warn("gateway: failed to parse pub/sub payload", "err", err)
		return
	}

	wsMsg, err := json.Marshal(map[string]any{
		"type": "VOICE_STATE_UPDATE",
		"data": json.RawMessage(msg.Payload),
	})
	if err != nil {
		return
	}

	s.hub.BroadcastToGuild(guildID, wsMsg)
}
