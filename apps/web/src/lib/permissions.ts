import { Member, Role } from "../types";

// ─── Permission Bit Flags ────────────────────────────────────────────────────

export const Permission = {
  // General Guild Permissions
  CREATE_INSTANT_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  ADD_REACTIONS: 1n << 6n,
  VIEW_AUDIT_LOG: 1n << 7n,

  // Channel Text Permissions
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_HISTORY: 1n << 16n,
  MENTION_EVERYONE: 1n << 17n,

  // Voice Permissions
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  DEAFEN_MEMBERS: 1n << 23n,
  MOVE_MEMBERS: 1n << 24n,

  // General Management Permissions
  CHANGE_NICKNAME: 1n << 26n,
  MANAGE_NICKNAMES: 1n << 27n,
  MANAGE_ROLES: 1n << 28n,
} as const;

export type PermissionScope = "guild" | "channel";
export type ChannelTypeStr = "text" | "voice" | "category";

export interface PermissionMeta {
  bit: bigint;
  name: string;
  desc: string;
  scope: PermissionScope;
  appliesTo?: ChannelTypeStr[];
}

/**
 * Ordered list of all permissions for UI rendering (settings, role editor).
 */
export const ALL_PERMISSIONS: PermissionMeta[] = [
  // General Guild (scope: guild)
  { bit: Permission.ADMINISTRATOR, name: "Administrator", desc: "Grants all permissions and bypasses channel overrides.", scope: "guild" },
  { bit: Permission.VIEW_AUDIT_LOG, name: "View Audit Log", desc: "Allows members to view a record of who made which changes in this server.", scope: "guild" },
  { bit: Permission.MANAGE_GUILD, name: "Manage Server", desc: "Allows members to change this server's name, switch regions, and see the server widget.", scope: "guild" },
  { bit: Permission.MANAGE_ROLES, name: "Manage Roles", desc: "Allows members to create new roles and edit or delete roles lower than their highest role.", scope: "guild" },
  { bit: Permission.MANAGE_CHANNELS, name: "Manage Channels", desc: "Allows members to create, edit, or delete channels.", scope: "guild" },
  { bit: Permission.KICK_MEMBERS, name: "Kick Members", desc: "Allows members to remove other members from this server.", scope: "guild" },
  { bit: Permission.BAN_MEMBERS, name: "Ban Members", desc: "Allows members to permanently ban other members from this server.", scope: "guild" },
  { bit: Permission.CREATE_INSTANT_INVITE, name: "Create Invite", desc: "Allows members to invite new people to this server.", scope: "guild" },
  { bit: Permission.CHANGE_NICKNAME, name: "Change Nickname", desc: "Allows members to change their own nickname.", scope: "guild" },
  { bit: Permission.MANAGE_NICKNAMES, name: "Manage Nicknames", desc: "Allows members to change the nicknames of other members.", scope: "guild" },

  // Text Channel (scope: channel)
  { bit: Permission.VIEW_CHANNEL, name: "View Channels", desc: "Allows members to view channels by default.", scope: "channel", appliesTo: ["text", "voice", "category"] },
  { bit: Permission.SEND_MESSAGES, name: "Send Messages", desc: "Allows members to send messages in text channels.", scope: "channel", appliesTo: ["text", "category"] },
  { bit: Permission.MANAGE_MESSAGES, name: "Manage Messages", desc: "Allows members to delete messages sent by others or pin any message.", scope: "channel", appliesTo: ["text", "category"] },
  { bit: Permission.EMBED_LINKS, name: "Embed Links", desc: "Allows members' messages to automatically embed media and link previews.", scope: "channel", appliesTo: ["text", "category"] },
  { bit: Permission.ATTACH_FILES, name: "Attach Files", desc: "Allows members to upload files or media.", scope: "channel", appliesTo: ["text", "category"] },
  { bit: Permission.READ_HISTORY, name: "Read Message History", desc: "Allows members to read previous messages sent in channels.", scope: "channel", appliesTo: ["text", "category"] },
  { bit: Permission.MENTION_EVERYONE, name: "Mention @everyone", desc: "Allows members to use @everyone or @here.", scope: "channel", appliesTo: ["text", "category"] },
  { bit: Permission.ADD_REACTIONS, name: "Add Reactions", desc: "Allows members to add new emoji reactions to a message.", scope: "channel", appliesTo: ["text", "category"] },

  // Voice Channel (scope: channel)
  { bit: Permission.CONNECT, name: "Connect", desc: "Allows members to join voice channels.", scope: "channel", appliesTo: ["voice", "category"] },
  { bit: Permission.SPEAK, name: "Speak", desc: "Allows members to talk in voice channels.", scope: "channel", appliesTo: ["voice", "category"] },
  { bit: Permission.MUTE_MEMBERS, name: "Mute Members", desc: "Allows members to mute other members in voice channels.", scope: "channel", appliesTo: ["voice", "category"] },
  { bit: Permission.DEAFEN_MEMBERS, name: "Deafen Members", desc: "Allows members to deafen other members in voice channels.", scope: "channel", appliesTo: ["voice", "category"] },
  { bit: Permission.MOVE_MEMBERS, name: "Move Members", desc: "Allows members to move other members between voice channels.", scope: "channel", appliesTo: ["voice", "category"] },
];

// ─── Permission Helpers ──────────────────────────────────────────────────────

/**
 * Check if a permissions bitfield includes a specific flag.
 */
export function hasPermission(perms: bigint, flag: bigint): boolean {
  // Administrator bypasses all checks
  if ((perms & Permission.ADMINISTRATOR) === Permission.ADMINISTRATOR) return true;
  return (perms & flag) === flag;
}

/**
 * Toggle a permission bit on or off.
 */
export function togglePermission(perms: bigint, bit: bigint): bigint {
  return perms & bit ? perms & ~bit : perms | bit;
}

/**
 * Compute the combined permissions for a member across all their roles.
 */
export function computeMemberPermissions(member: Member, roles: Role[]): bigint {
  let combined = 0n;
  const memberRoleIds = member.roles || [];

  for (const roleId of memberRoleIds) {
    const role = roles.find((r) => r.id === roleId);
    if (role) {
      combined |= BigInt(role.permissions);
    }
  }

  // Always include the @everyone (default) role
  const defaultRole = roles.find((r) => r.is_default);
  if (defaultRole) {
    combined |= BigInt(defaultRole.permissions);
  }

  return combined;
}

/**
 * Check if a member can manage roles (has ADMINISTRATOR or MANAGE_ROLES).
 */
export function canManageRoles(member: Member | undefined, roles: Role[]): boolean {
  if (!member) return false;
  const perms = computeMemberPermissions(member, roles);
  return hasPermission(perms, Permission.MANAGE_ROLES);
}
