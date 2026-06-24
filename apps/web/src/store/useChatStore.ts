import { create } from "zustand";
import { api } from "../lib/api";

export interface Guild {
  id: string;
  name: string;
  icon_key?: string;
  owner_id: string;
  unread_count: number;
}

export interface Channel {
  id: string;
  guild_id?: string;
  parent_channel_id?: string;
  name: string;
  type: number; // 0: Text, 1: Voice, 2: Category, 3: DM
  position: number;
  topic?: string;
}

export interface Message {
  id: string;
  channel_id: string;
  author_id: string;
  reply_to_message_id?: string;
  message_type: number;
  content: string;
  created_at: string;
  edited_at?: string;
  reactions?: { emoji: string; count: number }[];
}

export interface Member {
  guild_id: string;
  user_id: string;
  username: string;
  display_name?: string;
  avatar_key?: string;
  nickname?: string;
  joined_at: string;
  is_muted: boolean;
}

interface ChatState {
  guilds: Guild[];
  activeGuildId: string | null;
  channels: Channel[];
  activeChannelId: string | null;
  messages: Message[];
  members: Member[];
  isLoading: boolean;
  error: string | null;

  fetchGuilds: () => Promise<void>;
  selectGuild: (guildId: string) => Promise<void>;
  createGuild: (name: string, description: string) => Promise<Guild>;
  fetchChannels: (guildId: string) => Promise<void>;
  createChannel: (guildId: string, name: string, type: number, topic?: string) => Promise<Channel>;
  fetchMessages: (channelId: string) => Promise<void>;
  sendMessage: (channelId: string, content: string) => Promise<Message>;
  fetchMembers: (guildId: string) => Promise<void>;
  createInvite: (guildId: string) => Promise<string>;
  joinGuild: (code: string) => Promise<void>;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  guilds: [],
  activeGuildId: null,
  channels: [],
  activeChannelId: null,
  messages: [],
  members: [],
  isLoading: false,
  error: null,

  clearChat: () => set({
    guilds: [],
    activeGuildId: null,
    channels: [],
    activeChannelId: null,
    messages: [],
    members: [],
    error: null,
  }),

  fetchGuilds: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<Guild[]>("/users/@me/guilds");
      const guilds = response.data || [];
      set({ guilds, isLoading: false });

      // Automatically select the first guild if none is selected
      const currentActive = get().activeGuildId;
      if (guilds.length > 0 && (!currentActive || !guilds.some((g) => g.id === currentActive))) {
        await get().selectGuild(guilds[0].id);
      } else if (guilds.length === 0) {
        set({ activeGuildId: null, channels: [], activeChannelId: null, messages: [], members: [] });
      }
    } catch (err: any) {
      set({ error: err.response?.data?.message || "Failed to load guilds", isLoading: false });
    }
  },

  selectGuild: async (guildId) => {
    set({ activeGuildId: guildId, activeChannelId: null, messages: [], channels: [], members: [] });
    await Promise.all([
      get().fetchChannels(guildId),
      get().fetchMembers(guildId),
    ]);
  },

  createGuild: async (name, description) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<Guild>("/guilds", { name, description });
      const newGuild = response.data;
      set({ isLoading: false });
      
      // Refresh guilds list
      await get().fetchGuilds();
      
      // Auto select the new guild
      await get().selectGuild(newGuild.id);
      return newGuild;
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to create guild";
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  fetchChannels: async (guildId) => {
    try {
      const response = await api.get<Channel[]>(`/guilds/${guildId}/channels`);
      const channels = response.data || [];
      set({ channels });

      // Auto-select first text channel if none is selected
      if (channels.length > 0) {
        const textChannels = channels.filter(c => c.type === 0);
        if (textChannels.length > 0) {
          const currentActive = get().activeChannelId;
          if (!currentActive || !channels.some(c => c.id === currentActive)) {
            await get().fetchMessages(textChannels[0].id);
          }
        }
      }
    } catch (err: any) {
      set({ error: err.response?.data?.message || "Failed to load channels" });
    }
  },

  createChannel: async (guildId, name, type, topic) => {
    try {
      const response = await api.post<Channel>(`/guilds/${guildId}/channels`, { name, type, topic });
      const newChan = response.data;
      
      // Refresh channels
      await get().fetchChannels(guildId);
      
      // If it is a text channel, auto-select it
      if (type === 0) {
        await get().fetchMessages(newChan.id);
      }
      return newChan;
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to create channel";
      throw new Error(msg);
    }
  },

  fetchMessages: async (channelId) => {
    set({ activeChannelId: channelId, messages: [] });
    try {
      const response = await api.get<Message[]>(`/channels/${channelId}/messages?limit=50`);
      // API returns messages ordered DESC, we reverse them to show chronologically in chat window
      const messages = (response.data || []).reverse();
      set({ messages });

      // Call mark-as-read in background
      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        api.post(`/channels/${channelId}/read`, { last_read_message_id: lastMsg.id }).catch(() => {});
      }
    } catch (err: any) {
      set({ error: err.response?.data?.message || "Failed to load messages" });
    }
  },

  sendMessage: async (channelId, content) => {
    try {
      const response = await api.post<Message>(`/channels/${channelId}/messages`, { content });
      const newMsg = response.data;
      
      // Append locally
      set((state) => ({
        messages: [...state.messages, newMsg],
      }));
      
      // Call read update
      api.post(`/channels/${channelId}/read`, { last_read_message_id: newMsg.id }).catch(() => {});

      return newMsg;
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to send message";
      throw new Error(msg);
    }
  },

  fetchMembers: async (guildId) => {
    try {
      const response = await api.get<Member[]>(`/guilds/${guildId}/members?limit=100`);
      set({ members: response.data || [] });
    } catch (err: any) {
      // Don't crash UI, set empty members list
      set({ members: [] });
    }
  },

  createInvite: async (guildId) => {
    try {
      // Expiration: 1 day, uses: 10
      const response = await api.post<{ code: string }>(`/guilds/${guildId}/invites`, {
        max_uses: 10,
        duration: 86400,
      });
      return response.data.code;
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to create invite";
      throw new Error(msg);
    }
  },

  joinGuild: async (code) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/invites/${code}/join`);
      set({ isLoading: false });
      
      // Refresh guilds list to include joined guild
      await get().fetchGuilds();
    } catch (err: any) {
      const msg = err.response?.data?.message || "Invalid or expired invite code";
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },
}));
