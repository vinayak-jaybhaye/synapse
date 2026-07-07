package websocket

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"sync"
)

type ChannelMessage struct {
	ChannelID int64
	Payload   []byte
}

type GuildMessage struct {
	GuildID int64
	Payload []byte
}

type Hub struct {
	clients        map[*Client]bool
	channelClients map[int64]map[*Client]bool
	guildClients   map[int64]map[*Client]bool
	DB             *sql.DB

	mu sync.RWMutex

	Register         chan *Client
	Unregister       chan *Client
	BroadcastChannel chan ChannelMessage
	BroadcastGuild   chan GuildMessage
}

func NewHub(db *sql.DB) *Hub {
	return &Hub{
		clients:          make(map[*Client]bool),
		channelClients:   make(map[int64]map[*Client]bool),
		guildClients:     make(map[int64]map[*Client]bool),
		DB:               db,
		Register:         make(chan *Client, 64),
		Unregister:       make(chan *Client, 64),
		BroadcastChannel: make(chan ChannelMessage, 512),
		BroadcastGuild:   make(chan GuildMessage, 512),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			h.clients[client] = true
			for _, cid := range client.channelIDs {
				if h.channelClients[cid] == nil {
					h.channelClients[cid] = make(map[*Client]bool)
				}
				h.channelClients[cid][client] = true
			}
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
				for _, cid := range client.channelIDs {
					delete(h.channelClients[cid], client)
					if len(h.channelClients[cid]) == 0 {
						delete(h.channelClients, cid)
					}
				}
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

		case msg := <-h.BroadcastChannel:
			h.mu.RLock()
			var targets []*Client
			for client := range h.channelClients[msg.ChannelID] {
				targets = append(targets, client)
			}
			h.mu.RUnlock()

			for _, client := range targets {
				select {
				case client.send <- msg.Payload:
				default:
					h.Unregister <- client
				}
			}

		case msg := <-h.BroadcastGuild:
			h.mu.RLock()
			var targets []*Client
			for client := range h.guildClients[msg.GuildID] {
				targets = append(targets, client)
			}
			h.mu.RUnlock()

			for _, client := range targets {
				select {
				case client.send <- msg.Payload:
				default:
					h.Unregister <- client
				}
			}
		}
	}
}

// BroadcastToUser sends a message to all active sessions of a specific user.
func (h *Hub) BroadcastToUser(userID int64, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for c := range h.clients {
		if c.userID == userID {
			select {
			case c.send <- message:
			default:
				h.Unregister <- c
			}
		}
	}
}

// BroadcastToChannel sends a message to all clients subscribed to a specific channel.
func (h *Hub) BroadcastToChannel(channelID int64, payload []byte) {
	h.BroadcastChannel <- ChannelMessage{ChannelID: channelID, Payload: payload}
}

func (h *Hub) BroadcastToGuild(guildID int64, payload []byte) {
	h.BroadcastGuild <- GuildMessage{GuildID: guildID, Payload: payload}
}

// HandleChannelPermissionsUpdate processes real-time channel role permissions changes.
// It recalculates channel access for all connected members in the guild in a single batch database lookup.
// If a user loses view access to the channel, it unsubscribes them from the channel and sends them a targeted
// lost-access notification (CHANNEL_DELETE payload).
// If a user gains view access, it dynamically registers them.
func (h *Hub) HandleChannelPermissionsUpdate(ctx context.Context, guildID, channelID int64, isRestricted bool) {
	// Query currently connected clients for the guild using read lock.
	h.mu.Lock()
	var clients []*Client
	for c := range h.guildClients[guildID] {
		clients = append(clients, c)
	}
	h.mu.Unlock()

	if len(clients) == 0 {
		return
	}

	// Deduplicate client user IDs to prepare for the batched permission calculation query.
	userIDs := make([]int64, 0, len(clients))
	userIDMap := make(map[int64]bool)
	for _, c := range clients {
		if !userIDMap[c.userID] {
			userIDMap[c.userID] = true
			userIDs = append(userIDs, c.userID)
		}
	}

	// Batch query the database for effective channel access permissions across all active user IDs.
	perms, err := ResolveChannelAccessBatch(ctx, h.DB, userIDs, channelID)
	if err != nil {
		slog.Error("gateway: failed to resolve channel permissions in update", "err", err, "channelID", channelID)
		return
	}

	// Lock the Hub for write access to safely update client subscription lists and client mappings.
	h.mu.Lock()
	defer h.mu.Unlock()

	// Ensure the inner subscription map for this channel exists.
	if h.channelClients[channelID] == nil {
		h.channelClients[channelID] = make(map[*Client]bool)
	}

	for _, c := range clients {
		p, ok := perms[c.userID]
		hasAccess := false
		if ok {
			hasAccess = HasPermission(p, VIEW_CHANNEL)
		} else {
			// If no overrides are set on the channel (isRestricted == false),
			// all members of the guild are allowed to view this channel by default.
			hasAccess = !isRestricted
		}

		isSubscribed := h.channelClients[channelID][c]

		if isSubscribed && !hasAccess {
			// User lost access: unsubscribe them from the channel.
			delete(h.channelClients[channelID], c)

			// Remove the channel ID from the client's cached subscription slice.
			var newCIDs []int64
			for _, cid := range c.channelIDs {
				if cid != channelID {
					newCIDs = append(newCIDs, cid)
				}
			}
			c.channelIDs = newCIDs

			// Send the user a targeted "CHANNEL_DELETE" dispatch notice, causing the client
			// to remove the channel visually from their UI.
			lostMsg := map[string]any{
				"op": "DISPATCH",
				"t":  "CHANNEL_DELETE",
				"d": map[string]any{
					"id":       strconv.FormatInt(channelID, 10),
					"guild_id": strconv.FormatInt(guildID, 10),
				},
			}
			b, _ := json.Marshal(lostMsg)
			select {
			case c.send <- b:
			default:
			}

		} else if !isSubscribed && hasAccess {
			// User gained access: subscribe them to the channel.
			c.channelIDs = append(c.channelIDs, channelID)
			h.channelClients[channelID][c] = true
		}
	}

	// Clean up empty channel mapping from memory.
	if len(h.channelClients[channelID]) == 0 {
		delete(h.channelClients, channelID)
	}
}

// HandleGuildRoleUpdate processes role permission modifications across the guild.
// When a role is edited, the permissions change might affect several restricted channels for role holders.
//
// Optimized handling:
//  1. Fetch all members assigned to this role in the guild.
//  2. Filter currently connected holders of this role.
//  3. Fetch all restricted channels (channels with custom role overrides) in the guild.
//  4. If the role update grants ADMINISTRATOR, trigger the fast-path (unconditional subscribe without loop).
//  5. Otherwise, run the batched permissions check per restricted channel and diff subscriptions.
func (h *Hub) HandleGuildRoleUpdate(ctx context.Context, guildID, roleID int64, grantsAdmin bool) {
	// Query database for all users holding this role.
	rows, err := h.DB.QueryContext(ctx, `
		SELECT user_id FROM member_roles WHERE guild_id = $1 AND role_id = $2
	`, guildID, roleID)
	if err != nil {
		slog.Error("gateway: failed to get members for role", "err", err, "roleID", roleID)
		return
	}
	defer rows.Close()

	roleHolders := make(map[int64]bool)
	var holderIDs []int64
	for rows.Next() {
		var uid int64
		if err := rows.Scan(&uid); err == nil {
			roleHolders[uid] = true
			holderIDs = append(holderIDs, uid)
		}
	}

	if len(holderIDs) == 0 {
		return
	}

	// Intersect role holders with active connections.
	h.mu.RLock()
	var connectedHolders []*Client
	for c := range h.guildClients[guildID] {
		if roleHolders[c.userID] {
			connectedHolders = append(connectedHolders, c)
		}
	}
	h.mu.RUnlock()

	if len(connectedHolders) == 0 {
		return
	}

	// Find all channels that currently contain overrides in this guild.
	chanRows, err := h.DB.QueryContext(ctx, `
		SELECT DISTINCT channel_id FROM channel_role_permissions WHERE channel_id IN (
			SELECT id FROM channels WHERE guild_id = $1 AND deleted_at IS NULL
		)
	`, guildID)
	if err != nil {
		slog.Error("gateway: failed to get restricted channels", "err", err, "guildID", guildID)
		return
	}
	defer chanRows.Close()

	var restrictedChannels []int64
	for chanRows.Next() {
		var cid int64
		if err := chanRows.Scan(&cid); err == nil {
			restrictedChannels = append(restrictedChannels, cid)
		}
	}

	if len(restrictedChannels) == 0 {
		return
	}

	// ADMINISTRATOR Fast-path:
	// If a role is granted ADMINISTRATOR, all holders unconditionally bypass channel-level overrides.
	// We can subscribe all connected holders to every restricted channel directly, skipping per-channel SQL lookups.
	if grantsAdmin {
		h.mu.Lock()
		defer h.mu.Unlock()

		for _, cid := range restrictedChannels {
			if h.channelClients[cid] == nil {
				h.channelClients[cid] = make(map[*Client]bool)
			}
			for _, c := range connectedHolders {
				if !h.channelClients[cid][c] {
					c.channelIDs = append(c.channelIDs, cid)
					h.channelClients[cid][c] = true
				}
			}
		}
		return
	}

	// Loop through restricted channels, running a batched permissions lookup for the custom holders group.
	for _, cid := range restrictedChannels {
		perms, err := ResolveChannelAccessBatch(ctx, h.DB, holderIDs, cid)
		if err != nil {
			continue
		}

		h.mu.Lock()
		if h.channelClients[cid] == nil {
			h.channelClients[cid] = make(map[*Client]bool)
		}

		for _, c := range connectedHolders {
			p, ok := perms[c.userID]
			hasAccess := false
			if ok {
				hasAccess = HasPermission(p, VIEW_CHANNEL)
			}

			isSubscribed := h.channelClients[cid][c]

			if isSubscribed && !hasAccess {
				// Access lost: unsubscribe user connection.
				delete(h.channelClients[cid], c)
				var newCIDs []int64
				for _, id := range c.channelIDs {
					if id != cid {
						newCIDs = append(newCIDs, id)
					}
				}
				c.channelIDs = newCIDs

				lostMsg := map[string]any{
					"op": "DISPATCH",
					"t":  "CHANNEL_DELETE",
					"d": map[string]any{
						"id":       strconv.FormatInt(cid, 10),
						"guild_id": strconv.FormatInt(guildID, 10),
					},
				}
				b, _ := json.Marshal(lostMsg)
				select {
				case c.send <- b:
				default:
				}

			} else if !isSubscribed && hasAccess {
				// Access gained: subscribe user connection.
				c.channelIDs = append(c.channelIDs, cid)
				h.channelClients[cid][c] = true
			}
		}

		if len(h.channelClients[cid]) == 0 {
			delete(h.channelClients, cid)
		}
		h.mu.Unlock()
	}
}

// HandleGuildMemberUpdate processes a role assignment or removal for a single user (GUILD_MEMBER_UPDATE).
// It re-evaluates channel access for the user's active client connections across all restricted channels in the guild.
func (h *Hub) HandleGuildMemberUpdate(ctx context.Context, guildID, userID int64) {
	// Find user's active WebSocket client connections in this guild.
	h.mu.RLock()
	var userClients []*Client
	for c := range h.guildClients[guildID] {
		if c.userID == userID {
			userClients = append(userClients, c)
		}
	}
	h.mu.RUnlock()

	if len(userClients) == 0 {
		return
	}

	// Fetch restricted channels in this guild.
	chanRows, err := h.DB.QueryContext(ctx, `
		SELECT DISTINCT channel_id FROM channel_role_permissions WHERE channel_id IN (
			SELECT id FROM channels WHERE guild_id = $1 AND deleted_at IS NULL
		)
	`, guildID)
	if err != nil {
		slog.Error("gateway: failed to get restricted channels", "err", err, "guildID", guildID)
		return
	}
	defer chanRows.Close()

	var restrictedChannels []int64
	for chanRows.Next() {
		var cid int64
		if err := chanRows.Scan(&cid); err == nil {
			restrictedChannels = append(restrictedChannels, cid)
		}
	}

	if len(restrictedChannels) == 0 {
		return
	}

	// Evaluate channel access and adjust user's subscriptions.
	for _, cid := range restrictedChannels {
		p, err := ResolveChannelAccess(ctx, h.DB, userID, cid)
		if err != nil {
			continue
		}

		hasAccess := HasPermission(p, VIEW_CHANNEL)

		h.mu.Lock()
		if h.channelClients[cid] == nil {
			h.channelClients[cid] = make(map[*Client]bool)
		}

		for _, c := range userClients {
			isSubscribed := h.channelClients[cid][c]

			if isSubscribed && !hasAccess {
				// Access lost: unsubscribe user.
				delete(h.channelClients[cid], c)
				var newCIDs []int64
				for _, id := range c.channelIDs {
					if id != cid {
						newCIDs = append(newCIDs, id)
					}
				}
				c.channelIDs = newCIDs

				lostMsg := map[string]any{
					"op": "DISPATCH",
					"t":  "CHANNEL_DELETE",
					"d": map[string]any{
						"id":       strconv.FormatInt(cid, 10),
						"guild_id": strconv.FormatInt(guildID, 10),
					},
				}
				b, _ := json.Marshal(lostMsg)
				select {
				case c.send <- b:
				default:
				}

			} else if !isSubscribed && hasAccess {
				// Access gained: subscribe user.
				c.channelIDs = append(c.channelIDs, cid)
				h.channelClients[cid][c] = true
			}
		}

		if len(h.channelClients[cid]) == 0 {
			delete(h.channelClients, cid)
		}
		h.mu.Unlock()
	}
}

// HandleGuildMemberAdd processes a user joining a guild (GUILD_MEMBER_ADD).
// It discovers the user's active connections, maps them to the new guild, and dynamically subscribes
// them to all accessible channels in that guild.
func (h *Hub) HandleGuildMemberAdd(ctx context.Context, guildID, userID int64) {
	// Find user's active WebSocket client connections globally.
	h.mu.RLock()
	var userClients []*Client
	for c := range h.clients {
		if c.userID == userID {
			userClients = append(userClients, c)
		}
	}
	h.mu.RUnlock()

	if len(userClients) == 0 {
		return
	}

	// Lock Hub to update guild association.
	h.mu.Lock()
	if h.guildClients[guildID] == nil {
		h.guildClients[guildID] = make(map[*Client]bool)
	}
	for _, c := range userClients {
		// Only add if not already present
		hasGuild := false
		for _, gid := range c.guildIDs {
			if gid == guildID {
				hasGuild = true
				break
			}
		}
		if !hasGuild {
			c.guildIDs = append(c.guildIDs, guildID)
		}
		h.guildClients[guildID][c] = true
	}
	h.mu.Unlock()

	// Broadcast presence immediately to the newly joined guild if online
	c := userClients[0]
	msg := map[string]any{
		"op": "DISPATCH",
		"t":  "PRESENCE_UPDATE",
		"d": map[string]any{
			"user_id": strconv.FormatInt(c.userID, 10),
			"status":  "online",
		},
	}
	b, _ := json.Marshal(msg)
	c.rdb.Publish(context.Background(), fmt.Sprintf("guild:%d", guildID), string(b))

	// Fetch ALL channels in this guild.
	chanRows, err := h.DB.QueryContext(ctx, `
		SELECT id FROM channels WHERE guild_id = $1 AND deleted_at IS NULL
	`, guildID)
	if err != nil {
		slog.Error("gateway: failed to get channels for member add", "err", err, "guildID", guildID)
		return
	}
	defer chanRows.Close()

	var channels []int64
	for chanRows.Next() {
		var cid int64
		if err := chanRows.Scan(&cid); err == nil {
			channels = append(channels, cid)
		}
	}

	// Evaluate channel access and adjust user's subscriptions.
	for _, cid := range channels {
		p, err := ResolveChannelAccess(ctx, h.DB, userID, cid)
		if err != nil {
			continue
		}

		hasAccess := HasPermission(p, VIEW_CHANNEL)
		if !hasAccess {
			continue
		}

		h.mu.Lock()
		if h.channelClients[cid] == nil {
			h.channelClients[cid] = make(map[*Client]bool)
		}

		for _, c := range userClients {
			isSubscribed := h.channelClients[cid][c]
			if !isSubscribed {
				c.channelIDs = append(c.channelIDs, cid)
				h.channelClients[cid][c] = true
			}
		}
		h.mu.Unlock()
	}
}

// HandleGuildMemberRemove processes a user leaving a guild (GUILD_MEMBER_REMOVE).
// It instantly unsubscribes their active connections from all channels in that guild.
func (h *Hub) HandleGuildMemberRemove(ctx context.Context, guildID, userID int64) {
	// Find user's active WebSocket client connections in this guild.
	h.mu.RLock()
	var userClients []*Client
	for c := range h.guildClients[guildID] {
		if c.userID == userID {
			userClients = append(userClients, c)
		}
	}
	h.mu.RUnlock()

	if len(userClients) == 0 {
		return
	}

	// Fetch all channels in this guild to remove subscriptions.
	chanRows, err := h.DB.QueryContext(ctx, `
		SELECT id FROM channels WHERE guild_id = $1
	`, guildID)
	if err != nil {
		slog.Error("gateway: failed to get channels for member remove", "err", err, "guildID", guildID)
		return
	}
	defer chanRows.Close()

	var channels []int64
	for chanRows.Next() {
		var cid int64
		if err := chanRows.Scan(&cid); err == nil {
			channels = append(channels, cid)
		}
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	for _, c := range userClients {
		// Send the user a targeted "GUILD_DELETE" dispatch notice, causing the client
		// to remove the guild visually from their UI, since they will be removed from the
		// broadcast pool before the original pubsub event is fanned out.
		lostMsg := map[string]any{
			"op": "DISPATCH",
			"t":  "GUILD_DELETE",
			"d": map[string]any{
				"id": strconv.FormatInt(guildID, 10),
			},
		}
		b, _ := json.Marshal(lostMsg)
		select {
		case c.send <- b:
		default:
		}

		// Remove guild association
		var newGIDs []int64
		for _, gid := range c.guildIDs {
			if gid != guildID {
				newGIDs = append(newGIDs, gid)
			}
		}
		c.guildIDs = newGIDs
		delete(h.guildClients[guildID], c)

		// Remove channel subscriptions
		var newCIDs []int64
		for _, cid := range c.channelIDs {
			belongsToGuild := false
			for _, guildChanID := range channels {
				if cid == guildChanID {
					belongsToGuild = true
					break
				}
			}

			if belongsToGuild {
				delete(h.channelClients[cid], c)
			} else {
				newCIDs = append(newCIDs, cid)
			}
		}
		c.channelIDs = newCIDs
	}

	if len(h.guildClients[guildID]) == 0 {
		delete(h.guildClients, guildID)
	}

	// Cleanup empty channel sets
	for _, cid := range channels {
		if len(h.channelClients[cid]) == 0 {
			delete(h.channelClients, cid)
		}
	}
}

// HandleUserDMCreate dynamically subscribes participants to a new DM channel.
// This is critical for deferred DM creation, as the target user won't be subscribed
// to this channel id since it was created after they connected to the gateway.
func (h *Hub) HandleUserDMCreate(ctx context.Context, channelID, user1ID, user2ID int64) {
	h.mu.Lock()
	if h.channelClients[channelID] == nil {
		h.channelClients[channelID] = make(map[*Client]bool)
	}

	var targets []*Client
	for c := range h.clients {
		if c.userID == user1ID || c.userID == user2ID {
			c.channelIDs = append(c.channelIDs, channelID)
			h.channelClients[channelID][c] = true
			targets = append(targets, c)
		}
	}
	h.mu.Unlock()

	if len(targets) == 0 {
		return
	}

	msg := map[string]any{
		"op": "DISPATCH",
		"t":  "USER_DM_CREATE",
		"d": map[string]any{
			"channel_id": strconv.FormatInt(channelID, 10),
		},
	}
	b, _ := json.Marshal(msg)

	for _, c := range targets {
		select {
		case c.send <- b:
		default:
			close(c.send)
		}
	}
}
