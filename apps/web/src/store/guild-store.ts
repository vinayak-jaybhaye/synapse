import { create } from "zustand";

interface GuildState {
  activeGuildId: string | null;
  selectGuild: (guildId: string | null) => void;
}

export const useGuildStore = create<GuildState>((set) => ({
  activeGuildId: null,
  selectGuild: (guildId) => set({ activeGuildId: guildId }),
}));
