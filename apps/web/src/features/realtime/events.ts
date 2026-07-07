// Durable Events (must go through the transactional outbox)
export const DurableEvents = {
  MESSAGE_CREATE: "MESSAGE_CREATE",
  MESSAGE_UPDATE: "MESSAGE_UPDATE",
  MESSAGE_DELETE: "MESSAGE_DELETE",
  MESSAGE_REACTION_ADD: "MESSAGE_REACTION_ADD",
  MESSAGE_REACTION_REMOVE: "MESSAGE_REACTION_REMOVE",

  CHANNEL_CREATE: "CHANNEL_CREATE",
  CHANNEL_UPDATE: "CHANNEL_UPDATE",
  CHANNEL_DELETE: "CHANNEL_DELETE",

  GUILD_UPDATE: "GUILD_UPDATE",
  GUILD_MEMBER_ADD: "GUILD_MEMBER_ADD",
  GUILD_MEMBER_REMOVE: "GUILD_MEMBER_REMOVE",
  GUILD_MEMBER_UPDATE: "GUILD_MEMBER_UPDATE",
  GUILD_BAN_ADD: "GUILD_BAN_ADD",

  GUILD_ROLE_CREATE: "GUILD_ROLE_CREATE",
  GUILD_ROLE_UPDATE: "GUILD_ROLE_UPDATE",
  GUILD_ROLE_DELETE: "GUILD_ROLE_DELETE",

  USER_UPDATE: "USER_UPDATE",
  USER_DM_CREATE: "USER_DM_CREATE",
  VOICE_STATE_UPDATE: "VOICE_STATE_UPDATE",
} as const;

export type DurableEventType = (typeof DurableEvents)[keyof typeof DurableEvents];

// Ephemeral Events (direct publish to Redis Streams, no DB write)
export const EphemeralEvents = {
  TYPING_START: "TYPING_START",
  PRESENCE_UPDATE: "PRESENCE_UPDATE",
  GUILD_PRESENCE_BULK: "GUILD_PRESENCE_BULK",
} as const;

export type EphemeralEventType = (typeof EphemeralEvents)[keyof typeof EphemeralEvents];

// Protocol Ops (Gateway Connection Bookkeeping)
export const GatewayOps = {
  HELLO: "HELLO",
  IDENTIFY: "IDENTIFY",
  DISPATCH: "DISPATCH",
  HEARTBEAT: "HEARTBEAT",
  HEARTBEAT_ACK: "HEARTBEAT_ACK",
  RECONNECT: "RECONNECT",
  INVALID_SESSION: "INVALID_SESSION",
  REQUEST_GUILD_PRESENCE: "REQUEST_GUILD_PRESENCE",
} as const;

export type GatewayOp = (typeof GatewayOps)[keyof typeof GatewayOps];

// Generic Event Payload Shape
export interface GatewayEvent<T = unknown> {
  op: GatewayOp;
  t?: DurableEventType | EphemeralEventType; // event type, only present if op === DISPATCH
  d: T; // payload data
}
