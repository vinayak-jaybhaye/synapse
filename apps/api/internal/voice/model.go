package voice

import "time"

// VoiceState represents a user's current voice presence in a channel.
// Stored as a Redis Hash keyed by voice:guild:{guildID}:user:{userID}.
type VoiceState struct {
	UserID      int64     `json:"user_id,string"`
	ChannelID   int64     `json:"channel_id,string"`
	GuildID     int64     `json:"guild_id,string"`

	SelfMute    bool      `json:"self_mute"`
	SelfDeaf    bool      `json:"self_deaf"`

	ServerMute  bool      `json:"server_mute"`  // moderator-enforced; client cannot override
	ServerDeaf  bool      `json:"server_deaf"`  // moderator-enforced; client cannot override

	Video       bool      `json:"video"`
	ScreenShare bool      `json:"screen_share"`

	JoinedAt    time.Time `json:"joined_at"`
}


// JoinVoiceResponse is returned from POST /channels/:channelID/voice/join.
type JoinVoiceResponse struct {
	LiveKitURL string `json:"livekit_url"`
	Token      string `json:"token"`
	ExpiresIn  int    `json:"expires_in"` // seconds until token expiry
}
