package websocket

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	gtwauth "github.com/synapse/gateway/internal/auth"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = 50 * time.Second // < pongWait
	maxMessageSize = 8192
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

// Client represents a single WebSocket connection.
type Client struct {
	hub      *Hub
	conn     *websocket.Conn
	send     chan []byte
	userID   int64
	guildIDs []int64
	jwtSecret string
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins; production should restrict this
		return true
	},
}

// ServeWS upgrades an HTTP connection to WebSocket and starts read/write pumps.
func ServeWS(hub *Hub, jwtSecret string, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("gateway: websocket upgrade failed", "err", err)
		return
	}

	client := &Client{
		hub:       hub,
		conn:      conn,
		send:      make(chan []byte, 256),
		jwtSecret: jwtSecret,
	}

	go client.writePump()
	go client.readPump()
}

// readPump reads from the WebSocket and handles incoming messages.
func (c *Client) readPump() {
	defer func() {
		c.hub.Unregister <- c
		c.conn.Close()
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
	var msg InboundMessage
	if err := json.Unmarshal(raw, &msg); err != nil {
		return
	}

	switch msg.Type {
	case Ping:
		c.send <- mustMarshal(OutboundMessage{Type: Pong})

	case Identify:
		c.handleIdentify(msg.Data)

	case SubscribeGuild:
		c.handleSubscribeGuild(msg.Data)
	}
}

func (c *Client) handleIdentify(data json.RawMessage) {
	var payload struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return
	}

	claims, err := gtwauth.ValidateToken(payload.Token, c.jwtSecret)
	if err != nil {
		c.conn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseNormalClosure, "invalid token"))
		return
	}

	c.userID = claims.UserID
	c.guildIDs = claims.GuildIDs
	c.hub.Register <- c

	c.send <- mustMarshal(OutboundMessage{
		Type: Ready,
		Data: map[string]any{"user_id": claims.UserID},
	})
}

func (c *Client) handleSubscribeGuild(data json.RawMessage) {
	var payload struct {
		GuildID int64 `json:"guild_id,string"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return
	}
	if payload.GuildID != 0 {
		c.hub.SubscribeGuild(c, payload.GuildID)
	}
}

func mustMarshal(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}
