import { RemoteAudioTrack, RemoteVideoTrack, LocalAudioTrack, LocalVideoTrack } from "livekit-client";

// ─── Voice State (mirrors Go VoiceState) ─────────────────────────────────────

/**
 * VoiceState is the backend-persisted state for a user in a voice channel.
 * NOTE: `speaking` is intentionally absent — it is sourced only from LiveKit
 * ActiveSpeakersChanged events and is never stored or transmitted over the gateway.
 */
export interface VoiceState {
  user_id: string;
  channel_id: string;
  guild_id: string;
  self_mute: boolean;
  self_deaf: boolean;
  /** Server-enforced by a moderator. Client cannot clear this via UpdateVoiceState. */
  server_mute: boolean;
  /** Server-enforced by a moderator. Client cannot clear this via UpdateVoiceState. */
  server_deaf: boolean;
  video: boolean;
  screen_share: boolean;
  joined_at: string;
}

/**
 * VoiceParticipant extends VoiceState with LiveKit-sourced media state.
 * `speaking` is set exclusively by LiveKit's ActiveSpeakersChanged event.
 */
export interface VoiceParticipant extends VoiceState {
  username: string;
  display_name?: string;
  avatar_key?: string;
  /** From LiveKit ActiveSpeakersChanged — never persisted. */
  speaking: boolean;
  audioTrack?: RemoteAudioTrack | LocalAudioTrack;
  videoTrack?: RemoteVideoTrack | LocalVideoTrack;
  screenShareTrack?: RemoteVideoTrack | LocalVideoTrack;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface JoinVoiceResponse {
  livekit_url: string;
  token: string;
  expires_in: number; // seconds
}

// ─── Gateway Event ────────────────────────────────────────────────────────────

export interface VoiceStateEvent {
  action: "join" | "leave" | "update";
  guild_id: string;
  state: VoiceState;
}
