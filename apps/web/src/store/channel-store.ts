import { create } from "zustand";

interface ChannelState {
  activeChannelId: string | null;
  selectChannel: (channelId: string | null) => void;
}

export const useChannelStore = create<ChannelState>((set) => ({
  activeChannelId: null,
  selectChannel: (channelId) => set({ activeChannelId: channelId }),
}));
