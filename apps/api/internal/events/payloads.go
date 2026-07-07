package events

// Protocol Envelopes
type InboundEnvelope struct {
	Op   string         `json:"op"`
	Data map[string]any `json:"d"`
}

type OutboundEnvelope struct {
	Op   string `json:"op"`
	Type string `json:"t,omitempty"`
	Data any    `json:"d,omitempty"`
}

// HelloPayload is sent by the gateway immediately upon connection.
type HelloPayload struct {
	HeartbeatIntervalMs int `json:"heartbeat_interval"`
}

// IdentifyPayload is sent by the client to authenticate.
type IdentifyPayload struct {
	Token string `json:"token"`
}

// ReadyPayload is sent by the gateway upon successful IDENTIFY.
type ReadyPayload struct {
	UserID   int64   `json:"user_id,string"`
	Channels []int64 `json:"channels"`
}

// Durable Payload Types

type UserSummary struct {
	ID          int64  `json:"id,string"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	AvatarKey   string `json:"avatar_key"`
	BannerKey   string `json:"banner_key,omitempty"`
	Bio         string `json:"bio,omitempty"`
}

type MessageCreatePayload struct {
	ID        int64       `json:"id,string"`
	ChannelID int64       `json:"channel_id,string"`
	Author    UserSummary `json:"author"`
	Content   string      `json:"content"`
}

type MessageDeletePayload struct {
	ID        int64 `json:"id,string"`
	ChannelID int64 `json:"channel_id,string"`
}

type ChannelPermissionsUpdatePayload struct {
	ChannelID    int64 `json:"channel_id,string"`
	GuildID      int64 `json:"guild_id,string"`
	IsRestricted bool  `json:"is_restricted"`
}
