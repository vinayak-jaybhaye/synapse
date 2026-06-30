import { Message, Channel, Member } from "../../types";
import { VoiceStateEvent } from "../voice/types";

// ─── Gateway Event Types ─────────────────────────────────────────────────────
// Discriminated union of all events the realtime gateway can emit.

export type GatewayEvent =
  // Messaging
  | { type: "MESSAGE_CREATE"; data: Message }
  | { type: "MESSAGE_UPDATE"; data: Message }
  | { type: "MESSAGE_DELETE"; data: { id: string; channel_id: string } }

  // Typing
  | {
      type: "TYPING_START";
      data: { channel_id: string; user_id: string; timestamp: number };
    }
  | { type: "TYPING_STOP"; data: { channel_id: string; user_id: string } }

  // Presence
  | {
      type: "PRESENCE_UPDATE";
      data: { user_id: string; status: string; last_seen?: string };
    }

  // Channels
  | { type: "CHANNEL_CREATE"; data: Channel }
  | { type: "CHANNEL_UPDATE"; data: Channel }
  | { type: "CHANNEL_DELETE"; data: { id: string; guild_id: string } }

  // Members
  | { type: "MEMBER_JOIN"; data: Member }
  | { type: "MEMBER_LEAVE"; data: { guild_id: string; user_id: string } }
  | { type: "MEMBER_UPDATE"; data: Member }

  // Voice — full state event; `speaking` is intentionally absent (LiveKit-local only)
  | { type: "VOICE_STATE_UPDATE"; data: VoiceStateEvent }

  // Guild
  | {
      type: "GUILD_UPDATE";
      data: { id: string; name?: string; icon_key?: string };
    }

  // Read State
  | {
      type: "READ_STATE_UPDATE";
      data: { channel_id: string; last_read_message_id: string };
    };

// ─── Connection State ────────────────────────────────────────────────────────

export type GatewayConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

// ─── Gateway Interface ───────────────────────────────────────────────────────
// The rest of the application programs against this interface.
// The concrete implementation (WebSocket, SSE, polling) is swappable.

export type GatewayEventHandler = (event: GatewayEvent) => void;
export type GatewayStateHandler = (state: GatewayConnectionState) => void;

export interface IGateway {
  /** Current connection state */
  readonly state: GatewayConnectionState;

  /** Connect to the gateway with an auth token */
  connect(token: string): void;

  /** Gracefully disconnect */
  disconnect(): void;

  /** Register a handler for gateway events */
  onEvent(handler: GatewayEventHandler): () => void;

  /** Register a handler for connection state changes */
  onStateChange(handler: GatewayStateHandler): () => void;
}
