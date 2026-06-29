package websocket

import (
	"log/slog"
	"sync"
)

// GuildMessage is an outbound message targeted at all clients subscribed to a guild.
type GuildMessage struct {
	GuildID int64
	Payload []byte
}

// Hub maintains the registry of connected clients and broadcasts messages.
type Hub struct {
	// All registered clients
	clients map[*Client]bool
	// guildID → set of clients subscribed to that guild
	guildClients map[int64]map[*Client]bool

	mu sync.RWMutex

	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan GuildMessage
}

// NewHub creates an initialized Hub.
func NewHub() *Hub {
	return &Hub{
		clients:      make(map[*Client]bool),
		guildClients: make(map[int64]map[*Client]bool),
		Register:     make(chan *Client, 64),
		Unregister:   make(chan *Client, 64),
		Broadcast:    make(chan GuildMessage, 512),
	}
}

// Run starts the Hub's event loop. Should be called in a goroutine.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			h.clients[client] = true
			for _, gid := range client.guildIDs {
				if h.guildClients[gid] == nil {
					h.guildClients[gid] = make(map[*Client]bool)
				}
				h.guildClients[gid][client] = true
			}
			h.mu.Unlock()
			slog.Debug("gateway: client registered", "userID", client.userID)

		case client := <-h.Unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				for _, gid := range client.guildIDs {
					delete(h.guildClients[gid], client)
					if len(h.guildClients[gid]) == 0 {
						delete(h.guildClients, gid)
					}
				}
				close(client.send)
			}
			h.mu.Unlock()
			slog.Debug("gateway: client unregistered", "userID", client.userID)

		case msg := <-h.Broadcast:
			h.mu.RLock()
			targets := h.guildClients[msg.GuildID]
			h.mu.RUnlock()

			for client := range targets {
				select {
				case client.send <- msg.Payload:
				default:
					// Client send buffer full — disconnect
					h.Unregister <- client
				}
			}
		}
	}
}

// SubscribeGuild adds a client to a guild's subscriber set.
// Safe to call after Register from message handlers.
func (h *Hub) SubscribeGuild(client *Client, guildID int64) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.guildClients[guildID] == nil {
		h.guildClients[guildID] = make(map[*Client]bool)
	}
	h.guildClients[guildID][client] = true
	client.guildIDs = append(client.guildIDs, guildID)
}

// BroadcastToGuild enqueues a payload for all clients subscribed to the guild.
func (h *Hub) BroadcastToGuild(guildID int64, payload []byte) {
	h.Broadcast <- GuildMessage{GuildID: guildID, Payload: payload}
}
