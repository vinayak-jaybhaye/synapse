import { create } from "zustand";

interface PresenceState {
  statuses: Record<string, "online" | "offline">;
  setStatus: (userId: string | number, status: "online" | "offline") => void;
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
}));
