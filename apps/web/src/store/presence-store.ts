import { create } from "zustand";

export type UserPresenceStatus = "online" | "offline" | "idle" | "dnd";

interface PresenceState {
  statuses: Record<string, UserPresenceStatus>;
  setStatus: (userId: string | number, status: UserPresenceStatus) => void;
  clear: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  statuses: {},
  setStatus: (userId, status) =>
    set((state) => ({
      statuses: {
        ...state.statuses,
        [String(userId)]: status,
      },
    })),
  clear: () => set({ statuses: {} }),
}));
