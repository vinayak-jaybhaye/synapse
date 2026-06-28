// ─── Enums ───────────────────────────────────────────────────────────────────

export const ChannelType = {
  Text: 0,
  Voice: 1,
  Category: 2,
  DM: 3,
  Thread: 4,
  Forum: 5,
} as const;
export type ChannelType = (typeof ChannelType)[keyof typeof ChannelType];

export const MessageType = {
  Default: 0,
  System: 1,
  Reply: 2,
  ThreadStarter: 3,
  VoiceEvent: 4,
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const PresenceStatus = {
  Online: "online",
  Idle: "idle",
  DoNotDisturb: "dnd",
  Offline: "offline",
} as const;
export type PresenceStatus = (typeof PresenceStatus)[keyof typeof PresenceStatus];

// ─── Core Domain Models ──────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  display_name?: string;
  avatar_key?: string;
  banner_key?: string;
  bio?: string;
  email: string;
}


export const PermissionFlags = {
  CREATE_INSTANT_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  ADD_REACTIONS: 1n << 6n,
  VIEW_AUDIT_LOG: 1n << 7n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  MENTION_EVERYONE: 1n << 17n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  DEAFEN_MEMBERS: 1n << 23n,
  MOVE_MEMBERS: 1n << 24n,
  CHANGE_NICKNAME: 1n << 26n,
  MANAGE_NICKNAMES: 1n << 27n,
  MANAGE_ROLES: 1n << 28n,
} as const;

export const hasPermission = (permissions: string | undefined, flag: bigint): boolean => {
  if (!permissions) return false;
  try {
    const perms = BigInt(permissions);
    if ((perms & PermissionFlags.ADMINISTRATOR) === PermissionFlags.ADMINISTRATOR) {
      return true;
    }
    return (perms & flag) === flag;
  } catch {
    return false;
  }
};

export interface Guild {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  icon_key?: string;
  banner_key?: string;
  permissions?: string;
}

export interface Channel {
  id: string;
  guild_id?: string;
  parent_channel_id?: string;
  name: string;
  type: ChannelType;
  position: number;
  topic?: string;
  permissions?: string;
}

export interface ChannelRolePermissionOverride {
  channel_id: string;
  role_id: string;
  allow_permissions: string;
  deny_permissions: string;
}

export interface DMChannelResponse {
  channel_id: string;
  recipient: UserSummary;
}

export interface Member {
  guild_id: string;
  user_id: string;
  username: string;
  display_name?: string;
  avatar_key?: string;
  nickname?: string;
  joined_at: string;
  is_muted: boolean;
  roles: string[];
}

export interface Role {
  id: string;
  guild_id: string;
  name: string;
  color?: number;
  position: number;
  permissions: string;
  is_default?: boolean;
}

export interface Invite {
  id: string;
  guild_id: string;
  created_by: string;
  code: string;
  expires_at?: string;
  max_uses: number;
  uses: number;
  created_at: string;
}

// ─── Messaging ───────────────────────────────────────────────────────────────

export interface Attachment {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
}

export interface UserSummary {
  id: string;
  username: string;
  display_name: string;
  avatar_key: string;
  banner_key?: string;
  bio?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_key?: string;
  banner_key?: string;
  bio?: string;
  status?: "online" | "offline" | "idle" | "dnd";
  mutual_guilds?: number;
  created_at: string;
}

export interface Message {
  id: string;
  channel_id: string;
  author_id: string;
  author: UserSummary;
  reply_to_message_id?: string;
  reply_preview?: {
    id: string;
    author_id: string;
    username: string;
    content: string;
    deleted: boolean;
  };
  message_type: MessageType;
  content: string;
  attachments?: Attachment[];
  created_at: string;
  edited_at?: string;
  reactions?: ReactionSummary[];
  deleted: boolean;
}

// ─── API DTOs (not domain models — API-specific extensions) ──────────────────

export interface UserGuildDTO extends Guild {
  unread_count: number;
}

export interface InviteDetails {
  id: string;
  guild_id: string;
  created_by: string;
  code: string;
  expires_at?: string;
  max_uses: number;
  uses: number;
  guild_name: string;
}

export interface BanWithUser {
  guild_id: string;
  user_id: string;
  username: string;
  display_name?: string;
  avatar_key?: string;
  reason?: string;
  banned_by: string;
  created_at: string;
}

// ─── Media Uploads ──────────────────────────────────────────────────────────

export interface UploadResponse {
  upload_id: string;
  upload_url: string;
  object_key: string;
  expires_in: number;
}

export type UploadState = "QUEUED" | "UPLOADING" | "UPLOADED" | "FAILED";

export interface PendingUploadState {
  id: string; // internal UUID for tracking
  file: File;
  state: UploadState;
  progress: number;
  uploadId?: string;
  objectKey?: string;
  previewUrl?: string; // object URL for images
}
