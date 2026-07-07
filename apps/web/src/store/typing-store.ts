import { create } from "zustand";

interface TypingState {
  // channelId -> { userId -> timestamp }
  typing: Record<string, Record<string, number>>;
  setTyping: (channelId: string | number, userId: string | number) => void;
  // Automatically called by a React effect to clean up old typing indicators
  cleanupTyping: (channelId: string | number, maxAgeMs?: number) => void;
}

export const useTypingStore = create<TypingState>((set) => ({
  typing: {},
  setTyping: (channelId, userId) =>
    set((state) => {
      const cId = String(channelId);
      const uId = String(userId);
      const channelTyping = state.typing[cId] || {};

      return {
        typing: {
          ...state.typing,
          [cId]: {
            ...channelTyping,
            [uId]: Date.now(),
          },
        },
      };
    }),
  cleanupTyping: (channelId, maxAgeMs = 4000) =>
    set((state) => {
      const cId = String(channelId);
      const channelTyping = state.typing[cId];
      if (!channelTyping) return state;

      const now = Date.now();
      const updatedChannelTyping = { ...channelTyping };
      let changed = false;

      for (const [userId, timestamp] of Object.entries(updatedChannelTyping)) {
        if (now - timestamp > maxAgeMs) {
          delete updatedChannelTyping[userId];
          changed = true;
        }
      }

      if (!changed) return state;

      return {
        typing: {
          ...state.typing,
          [cId]: updatedChannelTyping,
        },
      };
    }),
}));
