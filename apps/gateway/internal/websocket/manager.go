// Package websocket manages WebSocket client connections, upgrades, read/write pumps,
// and inbound client event parsing.
package websocket

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
	gtwauth "github.com/synapse/gateway/internal/auth"
	"github.com/synapse/gateway/internal/presence"
)

// WebSocket Timing and Size Limits
const (
	writeWait      = 10 * time.Second // Write timeout
	pongWait       = 60 * time.Second // Pong timeout
	pingPeriod     = 50 * time.Second // Must be less than pongWait
	maxMessageSize = 8192             // Maximum frame size 8KB
)

// MessageType mirrors the event type discriminator used on the wire.
type MessageType string

const (
	Ping             MessageType = "PING"
	Pong             MessageType = "PONG"
	Identify         MessageType = "IDENTIFY"
	Ready            MessageType = "READY"
	SubscribeGuild   MessageType = "SUBSCRIBE_GUILD"
	ChatMessage      MessageType = "CHAT_MESSAGE"
	VoiceStateUpdate MessageType = "VOICE_STATE_UPDATE"
)

// InboundMessage is a typed envelope for messages received from clients.
type InboundMessage struct {
	Type MessageType     `json:"type"`
	Data json.RawMessage `json:"data,omitempty"`
}

// OutboundMessage is a typed envelope for messages sent to clients.
type OutboundMessage struct {
	Type MessageType `json:"type"`
	Data any         `json:"data,omitempty"`
}

// Client represents a single active WebSocket client connection.
// It maintains connection state, subscription lists, and write channels.
type Client struct {
	hub             *Hub                // Reference to the central connection Hub.
	conn            *websocket.Conn     // Underlying WebSocket connection.
	send            chan []byte         // Channel buffer for outbound WebSocket frames.
	userID          int64               // Authenticated user ID (0 if unauthorized).
	connID          string              // Unique random UUID for this specific connection.
	channelIDs      []int64             // List of channel IDs the user is currently subscribed to.
	guildIDs        []int64             // List of guild IDs the user is currently subscribed to.
	db              *sql.DB             // Postgres connection pool.
	rdb             *redis.Client       // Redis connection pool.
	cookieToken     string              // Cached cookie token fallback.
	lastTyping      map[int64]time.Time // Throttling tracker for typing events per channel.
	lastPresenceReq map[int64]time.Time // Throttling tracker for REQUEST_GUILD_PRESENCE per guild.
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// TODO: SECURITY - Restrict origins in production to prevent Cross-Site WebSocket Hijacking (CSWSH)
		return true
	},
}

// ServeWS upgrades an HTTP connection to WebSocket and starts read/write pumps.
func ServeWS(hub *Hub, db *sql.DB, rdb *redis.Client, cookieName string, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("gateway: websocket upgrade failed", "err", err)
		return
	}

	// Extract session token from cookie
	var cookieToken string
	cookie, err := r.Cookie(cookieName)
	if err == nil && cookie.Value != "" {
		cookieToken = cookie.Value
	} else {
		// Fallback to query param
		cookieToken = r.URL.Query().Get("token")
	}

	client := &Client{
		hub:             hub,
		conn:            conn,
		send:            make(chan []byte, 256),
		db:              db,
		rdb:             rdb,
		cookieToken:     cookieToken,
		connID:          uuid.NewString(),
		lastTyping:      make(map[int64]time.Time),
		lastPresenceReq: make(map[int64]time.Time),
	}

	// Send HELLO immediately per the protocol
	client.send <- mustMarshal(map[string]any{
		"op": "HELLO",
		"d": map[string]any{
			"heartbeat_interval": 45000,
		},
	})

	go client.writePump()
	go client.readPump()
}

// readPump reads from the WebSocket and handles incoming messages.
func (c *Client) readPump() {
	// Executes after readPump terminates, cleanup happens regardless of how the pump exits.
	defer func() {
		c.hub.Unregister <- c
		c.conn.Close()

		if c.userID != 0 {
			// If client was authenticated, remove user presence.
			wentOffline, _ := presence.MarkOffline(context.Background(), c.rdb, c.userID, c.connID)
			if wentOffline {
				// If no other clients for this user are online after 20s, broadcast offline status.
				time.AfterFunc(20*time.Second, func() {
					stillOnline, _ := presence.IsUserOnline(context.Background(), c.rdb, c.userID)
					if !stillOnline {
						c.fanoutPresence("offline")
					}
				})
			}
		}
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, rawMsg, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				slog.Warn("gateway: unexpected close", "userID", c.userID, "err", err)
			}
			break
		}
		c.handleMessage(rawMsg)
	}
}

// writePump drains the send channel and writes to the WebSocket.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage routes inbound messages to the appropriate handler.
func (c *Client) handleMessage(raw []byte) {
	var msg struct {
		Op   string          `json:"op"`
		Data json.RawMessage `json:"d"`
	}
	if err := json.Unmarshal(raw, &msg); err != nil {
		return
	}

	switch msg.Op {
	case "HEARTBEAT":
		c.send <- mustMarshal(map[string]any{"op": "HEARTBEAT_ACK"})
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		if c.userID != 0 {
			isOnline, _ := presence.MarkOnline(context.Background(), c.rdb, c.userID, c.connID)
			if isOnline {
				c.fanoutPresence("online")
			}
		}

	case "IDENTIFY":
		c.handleIdentify(msg.Data)

	case "TYPING_START":
		c.handleTypingStart(msg.Data)

	case "REQUEST_GUILD_PRESENCE":
		c.handleRequestGuildPresence(msg.Data)
	}
}

func (c *Client) handleIdentify(data json.RawMessage) {
	var payload struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return
	}

	token := payload.Token
	if token == "" {
		token = c.cookieToken
	}

	userID, err := gtwauth.ValidateSession(context.Background(), c.db, token)
	if err != nil {
		c.send <- mustMarshal(map[string]any{"op": "INVALID_SESSION"})
		c.conn.Close()
		return
	}

	// Fetch channels
	queryCh := `
		SELECT c.id 
		FROM channels c
		JOIN guild_members gm ON c.guild_id = gm.guild_id
		WHERE gm.user_id = $1
		UNION
		SELECT channel_id 
		FROM direct_conversations 
		WHERE user1_id = $1 OR user2_id = $1
	`
	rowsCh, err := c.db.Query(queryCh, userID)
	if err != nil {
		c.conn.Close()
		return
	}
	defer rowsCh.Close()

	var channelIDs []int64
	for rowsCh.Next() {
		var id int64
		if err := rowsCh.Scan(&id); err == nil {
			channelIDs = append(channelIDs, id)
		}
	}

	// Fetch guilds
	queryGd := `SELECT guild_id FROM guild_members WHERE user_id = $1`
	rowsGd, err := c.db.Query(queryGd, userID)
	if err != nil {
		c.conn.Close()
		return
	}
	defer rowsGd.Close()

	var guildIDs []int64
	for rowsGd.Next() {
		var id int64
		if err := rowsGd.Scan(&id); err == nil {
			guildIDs = append(guildIDs, id)
		}
	}

	c.userID = userID
	c.channelIDs = channelIDs
	c.guildIDs = guildIDs
	c.hub.Register <- c

	go func() {
		time.Sleep(250 * time.Millisecond)
		isOnline, _ := presence.MarkOnline(context.Background(), c.rdb, c.userID, c.connID)
		if isOnline {
			c.fanoutPresence("online")
		}
	}()

	c.send <- mustMarshal(map[string]any{
		"op": "DISPATCH",
		"t":  "READY",
		"d": map[string]any{
			"user_id":  userID,
			"channels": channelIDs,
			"guilds":   guildIDs,
		},
	})
}

func (c *Client) handleTypingStart(data json.RawMessage) {
	if c.userID == 0 {
		return
	}
	var payload struct {
		ChannelID int64 `json:"channel_id,string"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return
	}

	now := time.Now()
	if last, ok := c.lastTyping[payload.ChannelID]; ok {
		if now.Sub(last) < 3*time.Second {
			return // Rate limited
		}
	}
	c.lastTyping[payload.ChannelID] = now

	// Broadcast
	msg := map[string]any{
		"op": "DISPATCH",
		"t":  "TYPING_START",
		"d": map[string]any{
			"user_id":    strconv.FormatInt(c.userID, 10),
			"channel_id": strconv.FormatInt(payload.ChannelID, 10),
		},
	}
	b, _ := json.Marshal(msg)
	c.rdb.Publish(context.Background(), fmt.Sprintf("channel:%d", payload.ChannelID), string(b))
}

func (c *Client) fanoutPresence(status string) {
	msg := map[string]any{
		"op": "DISPATCH",
		"t":  "PRESENCE_UPDATE",
		"d": map[string]any{
			"user_id": strconv.FormatInt(c.userID, 10),
			"status":  status,
		},
	}
	b, _ := json.Marshal(msg)
	for _, gid := range c.guildIDs {
		c.rdb.Publish(context.Background(), fmt.Sprintf("guild:%d", gid), string(b))
	}
	for _, cid := range c.channelIDs {
		c.rdb.Publish(context.Background(), fmt.Sprintf("channel:%d", cid), string(b))
	}
}

func mustMarshal(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}

func (c *Client) handleRequestGuildPresence(data json.RawMessage) {
	if c.userID == 0 {
		return
	}
	var payload struct {
		GuildID int64 `json:"guild_id,string"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return
	}

	// Verify the requesting connection is actually subscribed to this guild
	isSubscribed := false
	for _, gid := range c.guildIDs {
		if gid == payload.GuildID {
			isSubscribed = true
			break
		}
	}
	if !isSubscribed {
		return
	}

	// Rate limiting (per-connection, per-guild)
	now := time.Now()
	if last, ok := c.lastPresenceReq[payload.GuildID]; ok {
		if now.Sub(last) < 5*time.Second {
			return
		}
	}
	c.lastPresenceReq[payload.GuildID] = now

	// Query Postgres for all member IDs in the guild
	query := `SELECT user_id FROM guild_members WHERE guild_id = $1`
	rows, err := c.db.QueryContext(context.Background(), query, payload.GuildID)
	if err != nil {
		return
	}
	defer rows.Close()

	var memberIDs []int64
	for rows.Next() {
		var uid int64
		if err := rows.Scan(&uid); err == nil {
			memberIDs = append(memberIDs, uid)
		}
	}

	if len(memberIDs) == 0 {
		return
	}

	// Pipelined ZCOUNT for every member ID
	timeSlice, err := c.rdb.Time(context.Background()).Result()
	if err != nil {
		return
	}
	nowStr := fmt.Sprintf("%d", timeSlice.Unix())

	pipe := c.rdb.Pipeline()
	var cmds []*redis.IntCmd
	for _, uid := range memberIDs {
		cmds = append(cmds, pipe.ZCount(context.Background(), fmt.Sprintf("presence:%d", uid), nowStr, "+inf"))
	}
	_, _ = pipe.Exec(context.Background())

	type PresenceItem struct {
		UserID int64  `json:"user_id,string"`
		Status string `json:"status"`
	}
	presences := make([]PresenceItem, len(memberIDs))

	for i, cmd := range cmds {
		status := "offline"
		if count, err := cmd.Result(); err == nil && count > 0 {
			status = "online"
		}
		presences[i] = PresenceItem{
			UserID: memberIDs[i],
			Status: status,
		}
	}

	c.send <- mustMarshal(map[string]any{
		"op": "DISPATCH",
		"t":  "GUILD_PRESENCE_BULK",
		"d": map[string]any{
			"guild_id":  strconv.FormatInt(payload.GuildID, 10),
			"presences": presences,
		},
	})
}
