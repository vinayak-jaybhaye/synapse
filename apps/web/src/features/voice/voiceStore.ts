import { create } from "zustand";
import { Room, ConnectionState } from "livekit-client";
import { VoiceParticipant, VoiceState, VoiceStateEvent } from "./types";

interface VoiceStore {
  // ── Connection ──────────────────────────────────────────────────────────────
  activeGuildId: string | null;
  activeChannelId: string | null;
  room: Room | null;
  connectionState: ConnectionState;

  // ── Participants (keyed by user_id string) ──────────────────────────────────
  participants: Map<string, VoiceParticipant>;

  // ── Own state (mirrors what backend has) ────────────────────────────────────
  selfState: VoiceState | null;

  // ── Actions ─────────────────────────────────────────────────────────────────
  setActive(guildId: string, channelId: string): void;
  clearActive(): void;
  setRoom(room: Room | null): void;
  setConnectionState(state: ConnectionState): void;
  setSelfState(state: VoiceState | null): void;

  /** Update or insert a participant (from LiveKit participant events) */
  setParticipant(userId: string, partial: Partial<VoiceParticipant>): void;

  /** Remove a participant when they leave LiveKit */
  removeParticipant(userId: string): void;

  /**
   * Process a VOICE_STATE_UPDATE event from the gateway.
   * Updates server-enforced fields for any participant; never touches `speaking`.
   */
  updateFromGatewayEvent(event: VoiceStateEvent): void;

  /**
   * Update the speaking flag for a participant.
   * ONLY called from LiveKit's ActiveSpeakersChanged event — never from the gateway.
   */
  setSpeaking(userId: string, speaking: boolean): void;
}

export const useVoiceStore = create<VoiceStore>((set, get) => ({
  activeGuildId: null,
  activeChannelId: null,
  room: null,
  connectionState: ConnectionState.Disconnected,
  participants: new Map(),
  selfState: null,

  setActive(guildId, channelId) {
    set({ activeGuildId: guildId, activeChannelId: channelId });
  },

  clearActive() {
    set({
      activeGuildId: null,
      activeChannelId: null,
      room: null,
      connectionState: ConnectionState.Disconnected,
      participants: new Map(),
      selfState: null,
    });
  },

  setRoom(room) {
    set({ room });
  },

  setConnectionState(state) {
    set({ connectionState: state });
  },

  setSelfState(state) {
    set({ selfState: state });
  },

  setParticipant(userId, partial) {
    set((s) => {
      const updated = new Map(s.participants);
      const existing =
        updated.get(userId) ??
        ({
          user_id: userId,
          channel_id: s.activeChannelId ?? "",
          guild_id: s.activeGuildId ?? "",
          self_mute: false,
          self_deaf: false,
          server_mute: false,
          server_deaf: false,
          video: false,
          screen_share: false,
          joined_at: new Date().toISOString(),
          username: userId,
          speaking: false,
        } as VoiceParticipant);
      updated.set(userId, { ...existing, ...partial });
      return { participants: updated };
    });
  },

  removeParticipant(userId) {
    set((s) => {
      const updated = new Map(s.participants);
      updated.delete(userId);
      return { participants: updated };
    });
  },

  updateFromGatewayEvent(event) {
    const { state, action } = event;
    const userId = state.user_id;

    if (action === "leave") {
      get().removeParticipant(userId);
      // If it's us, clear our own state
      if (get().selfState?.user_id === userId) {
        set({ selfState: null });
      }
      return;
    }

    // "join" or "update": merge backend state into participant map
    get().setParticipant(userId, {
      ...state,
      // Preserve existing LiveKit-sourced fields (speaking, tracks)
      speaking: get().participants.get(userId)?.speaking ?? false,
    });

    // If it's our own state, sync selfState
    const { selfState } = get();
    if (selfState?.user_id === userId || action === "join") {
      set({ selfState: state });
    }
  },

  setSpeaking(userId, speaking) {
    // Only touches the `speaking` field — never overwrites backend state
    set((s) => {
      const updated = new Map(s.participants);
      const existing = updated.get(userId);
      if (existing) {
        updated.set(userId, { ...existing, speaking });
      }
      return { participants: updated };
    });
  },
}));
