package permissions

// Permission represents a bitwise permission flag in Synapse.
type Permission uint64

// Core bitwise permission constants (Discord-scale bitmasks)
const (
	// General Guild Permissions
	CREATE_INSTANT_INVITE Permission = 1 << 0
	KICK_MEMBERS          Permission = 1 << 1
	BAN_MEMBERS           Permission = 1 << 2
	ADMINISTRATOR         Permission = 1 << 3
	MANAGE_CHANNELS       Permission = 1 << 4
	MANAGE_GUILD          Permission = 1 << 5
	ADD_REACTIONS         Permission = 1 << 6
	VIEW_AUDIT_LOG        Permission = 1 << 7

	// Channel Text Permissions
	VIEW_CHANNEL         Permission = 1 << 10
	SEND_MESSAGES        Permission = 1 << 11
	SEND_TTS_MESSAGES    Permission = 1 << 12
	MANAGE_MESSAGES      Permission = 1 << 13
	EMBED_LINKS          Permission = 1 << 14
	ATTACH_FILES         Permission = 1 << 15
	READ_MESSAGE_HISTORY Permission = 1 << 16
	MENTION_EVERYONE     Permission = 1 << 17
	USE_EXTERNAL_EMOJIS  Permission = 1 << 18

	// Voice Permissions
	CONNECT        Permission = 1 << 20
	SPEAK          Permission = 1 << 21
	MUTE_MEMBERS   Permission = 1 << 22
	DEAFEN_MEMBERS Permission = 1 << 23
	MOVE_MEMBERS   Permission = 1 << 24
	USE_VAD        Permission = 1 << 25

	// General Management Permissions
	CHANGE_NICKNAME  Permission = 1 << 26
	MANAGE_NICKNAMES Permission = 1 << 27
	MANAGE_ROLES     Permission = 1 << 28
	MANAGE_WEBHOOKS  Permission = 1 << 29
	MANAGE_EMOJIS    Permission = 1 << 30
)

// List of all permissions in defined bit order for stable serialization.
var allPermissions = []Permission{
	CREATE_INSTANT_INVITE,
	KICK_MEMBERS,
	BAN_MEMBERS,
	ADMINISTRATOR,
	MANAGE_CHANNELS,
	MANAGE_GUILD,
	ADD_REACTIONS,
	VIEW_AUDIT_LOG,
	VIEW_CHANNEL,
	SEND_MESSAGES,
	SEND_TTS_MESSAGES,
	MANAGE_MESSAGES,
	EMBED_LINKS,
	ATTACH_FILES,
	READ_MESSAGE_HISTORY,
	MENTION_EVERYONE,
	USE_EXTERNAL_EMOJIS,
	CONNECT,
	SPEAK,
	MUTE_MEMBERS,
	DEAFEN_MEMBERS,
	MOVE_MEMBERS,
	USE_VAD,
	CHANGE_NICKNAME,
	MANAGE_NICKNAMES,
	MANAGE_ROLES,
	MANAGE_WEBHOOKS,
	MANAGE_EMOJIS,
}

// PermissionNames maps each bitwise permission to its string representation.
var PermissionNames = map[Permission]string{
	CREATE_INSTANT_INVITE: "CREATE_INSTANT_INVITE",
	KICK_MEMBERS:          "KICK_MEMBERS",
	BAN_MEMBERS:           "BAN_MEMBERS",
	ADMINISTRATOR:         "ADMINISTRATOR",
	MANAGE_CHANNELS:       "MANAGE_CHANNELS",
	MANAGE_GUILD:          "MANAGE_GUILD",
	ADD_REACTIONS:         "ADD_REACTIONS",
	VIEW_AUDIT_LOG:        "VIEW_AUDIT_LOG",
	VIEW_CHANNEL:          "VIEW_CHANNEL",
	SEND_MESSAGES:         "SEND_MESSAGES",
	SEND_TTS_MESSAGES:    "SEND_TTS_MESSAGES",
	MANAGE_MESSAGES:      "MANAGE_MESSAGES",
	EMBED_LINKS:          "EMBED_LINKS",
	ATTACH_FILES:         "ATTACH_FILES",
	READ_MESSAGE_HISTORY: "READ_MESSAGE_HISTORY",
	MENTION_EVERYONE:     "MENTION_EVERYONE",
	USE_EXTERNAL_EMOJIS:  "USE_EXTERNAL_EMOJIS",
	CONNECT:              "CONNECT",
	SPEAK:                "SPEAK",
	MUTE_MEMBERS:         "MUTE_MEMBERS",
	DEAFEN_MEMBERS:       "DEAFEN_MEMBERS",
	MOVE_MEMBERS:         "MOVE_MEMBERS",
	USE_VAD:              "USE_VAD",
	CHANGE_NICKNAME:      "CHANGE_NICKNAME",
	MANAGE_NICKNAMES:     "MANAGE_NICKNAMES",
	MANAGE_ROLES:         "MANAGE_ROLES",
	MANAGE_WEBHOOKS:      "MANAGE_WEBHOOKS",
	MANAGE_EMOJIS:        "MANAGE_EMOJIS",
}

// PermissionName returns the string representation of a specific permission flag.
func PermissionName(p Permission) string {
	if name, ok := PermissionNames[p]; ok {
		return name
	}
	return "UNKNOWN"
}

// PermissionsToStrings converts a permission bitmask into a slice of human-readable strings.
func PermissionsToStrings(mask Permission) []string {
	var result []string
	// Administrator permission automatically grants everything
	if (mask & ADMINISTRATOR) == ADMINISTRATOR {
		for _, p := range allPermissions {
			result = append(result, PermissionNames[p])
		}
		return result
	}

	for _, p := range allPermissions {
		if (mask & p) == p {
			result = append(result, PermissionNames[p])
		}
	}
	return result
}

// Role represents a basic role domain model for permission calculation.
type Role struct {
	ID          int64
	Permissions Permission
	IsDefault   bool
}

// ChannelRolePermission represents a channel-level permission override for a role.
type ChannelRolePermission struct {
	ChannelID        int64
	RoleID           int64
	AllowPermissions Permission
	DenyPermissions  Permission
}
