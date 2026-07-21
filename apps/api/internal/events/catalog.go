package events

// Durable Events (must go through the transactional outbox)
const (
	MessageCreate         = "MESSAGE_CREATE"
	MessageUpdate         = "MESSAGE_UPDATE"
	MessageDelete         = "MESSAGE_DELETE"
	MessageReactionAdd    = "MESSAGE_REACTION_ADD"
	MessageReactionRemove = "MESSAGE_REACTION_REMOVE"

	ChannelCreate            = "CHANNEL_CREATE"
	ChannelUpdate            = "CHANNEL_UPDATE"
	ChannelDelete            = "CHANNEL_DELETE"
	ChannelPermissionsUpdate = "CHANNEL_PERMISSIONS_UPDATE"

	GuildUpdate       = "GUILD_UPDATE"
	GuildMemberAdd    = "GUILD_MEMBER_ADD"
	GuildMemberRemove = "GUILD_MEMBER_REMOVE"
	GuildMemberUpdate = "GUILD_MEMBER_UPDATE"
	GuildBanAdd       = "GUILD_BAN_ADD"

	GuildRoleCreate = "GUILD_ROLE_CREATE"
	GuildRoleUpdate = "GUILD_ROLE_UPDATE"
	GuildRoleDelete = "GUILD_ROLE_DELETE"

	UserUpdate       = "USER_UPDATE"
	UserDMCreate     = "USER_DM_CREATE"
	UserBlockAdd     = "USER_BLOCK_ADD"
	UserBlockRemove  = "USER_BLOCK_REMOVE"
	VoiceStateUpdate = "VOICE_STATE_UPDATE"

	NotificationCreated = "NOTIFICATION_CREATED"
	NotificationUpdated = "NOTIFICATION_UPDATED"
	NotificationDeleted = "NOTIFICATION_DELETED"
)

// Ephemeral Events (direct publish to Redis Streams, no DB write)
const (
	TypingStart    = "TYPING_START"
	PresenceUpdate = "PRESENCE_UPDATE"
)

// Protocol Ops (Gateway Connection Bookkeeping)
const (
	OpHello          = "HELLO"
	OpIdentify       = "IDENTIFY"
	OpDispatch       = "DISPATCH"
	OpHeartbeat      = "HEARTBEAT"
	OpHeartbeatAck   = "HEARTBEAT_ACK"
	OpReconnect      = "RECONNECT"
	OpInvalidSession = "INVALID_SESSION"
)
