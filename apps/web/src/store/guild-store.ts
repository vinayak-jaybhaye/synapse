import { create } from "zustand";

interface GuildState {
  activeGuildId: string | null;
  guildHydration: Record<string, "none" | "pending" | "hydrated">;
  selectGuild: (guildId: string | null) => void;
  setGuildHydration: (guildId: string, state: "none" | "pending" | "hydrated") => void;
  resetHydration: () => void;
}

export const useGuildStore = create<GuildState>((set) => ({
  activeGuildId: null,
  guildHydration: {},
  selectGuild: (guildId) => set({ activeGuildId: guildId }),
  setGuildHydration: (guildId, state) =>
    set((s) => ({ guildHydration: { ...s.guildHydration, [guildId]: state } })),
  resetHydration: () => set({ guildHydration: {} }),
}));
