package permissions

// Core bitwise permission constants (Discord-scale bitmasks)
const (
	// General Guild Permissions
	CREATE_INSTANT_INVITE int64 = 1 << 0
	KICK_MEMBERS          int64 = 1 << 1
	BAN_MEMBERS           int64 = 1 << 2
	ADMINISTRATOR         int64 = 1 << 3
	MANAGE_CHANNELS       int64 = 1 << 4
	MANAGE_GUILD          int64 = 1 << 5
	ADD_REACTIONS         int64 = 1 << 6
	VIEW_AUDIT_LOG        int64 = 1 << 7

	// Channel Text Permissions
	VIEW_CHANNEL         int64 = 1 << 10
	SEND_MESSAGES        int64 = 1 << 11
	SEND_TTS_MESSAGES    int64 = 1 << 12
	MANAGE_MESSAGES      int64 = 1 << 13
	EMBED_LINKS          int64 = 1 << 14
	ATTACH_FILES         int64 = 1 << 15
	READ_MESSAGE_HISTORY int64 = 1 << 16
	MENTION_EVERYONE     int64 = 1 << 17
	USE_EXTERNAL_EMOJIS  int64 = 1 << 18

	// Voice Permissions
	CONNECT        int64 = 1 << 20
	SPEAK          int64 = 1 << 21
	MUTE_MEMBERS   int64 = 1 << 22
	DEAFEN_MEMBERS int64 = 1 << 23
	MOVE_MEMBERS   int64 = 1 << 24
	USE_VAD        int64 = 1 << 25

	// General Management Permissions
	CHANGE_NICKNAME  int64 = 1 << 26
	MANAGE_NICKNAMES int64 = 1 << 27
	MANAGE_ROLES     int64 = 1 << 28
	MANAGE_WEBHOOKS  int64 = 1 << 29
	MANAGE_EMOJIS    int64 = 1 << 30
)

// HasPermission checks if a bitmask contains the specified permission.
func HasPermission(bitmask int64, perm int64) bool {
	// Administrator permission overrides all other restrictions
	if (bitmask & ADMINISTRATOR) == ADMINISTRATOR {
		return true
	}
	return (bitmask & perm) == perm
}
