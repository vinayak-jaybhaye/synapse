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

export interface Guild {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  icon_key?: string;
}

export interface Channel {
  id: string;
  guild_id?: string;
  parent_channel_id?: string;
  name: string;
  type: ChannelType;
  position: number;
  topic?: string;
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
  filename: string;
  content_type: string;
  size: number;
  url: string;
  width?: number;
  height?: number;
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
