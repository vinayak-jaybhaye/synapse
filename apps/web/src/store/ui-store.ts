import { create } from "zustand";

export type ThemeType = "dark" | "light" | "midnight" | "oled";
export type FontSize = "compact" | "normal" | "large";
export type FontFamily = "inter" | "geist" | "system-ui";
export type MessageDensity = "compact" | "comfortable";

interface UIState {
  // Modal states
  showCreateGuild: boolean;
  setShowCreateGuild: (show: boolean) => void;
  showJoinGuild: boolean;
  setShowJoinGuild: (show: boolean) => void;
  showInviteModal: boolean;
  setShowInviteModal: (show: boolean) => void;
  showCreateChannel: boolean;
  setShowCreateChannel: (show: boolean) => void;
  showCreateDM: boolean;
  setShowCreateDM: (show: boolean) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  settingsTab: string;
  setSettingsTab: (tab: string) => void;
  showGuildSettings: boolean;
  setShowGuildSettings: (show: boolean) => void;
  guildSettingsTab: string;
  setGuildSettingsTab: (tab: string) => void;
  showChannelSettings: boolean;
  setShowChannelSettings: (show: boolean) => void;
  activeChannelSettingsId: string | null;
  setActiveChannelSettingsId: (id: string | null) => void;

  // Sidebar states
  channelSidebarCollapsed: boolean;
  setChannelSidebarCollapsed: (collapsed: boolean) => void;
  membersSidebarCollapsed: boolean;
  setMembersSidebarCollapsed: (collapsed: boolean) => void;

  // Mobile drawer states
  mobileChannelsOpen: boolean;
  setMobileChannelsOpen: (open: boolean) => void;
  mobileMembersOpen: boolean;
  setMobileMembersOpen: (open: boolean) => void;

  // Panel widths
  channelSidebarWidth: number;
  setChannelSidebarWidth: (width: number) => void;
  membersSidebarWidth: number;
  setMembersSidebarWidth: (width: number) => void;

  // Appearance & Theme settings
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  fontFamily: FontFamily;
  setFontFamily: (family: FontFamily) => void;
  messageDensity: MessageDensity;
  setMessageDensity: (density: MessageDensity) => void;

  // Drafts
  drafts: Record<string, string>;
  setDraft: (channelId: string, text: string) => void;

  // Toast notifications
  toast: { message: string; type: "info" | "error" | "success"; id: number } | null;
  showToast: (message: string, type?: "info" | "error" | "success") => void;
  hideToast: () => void;
}

export const useUIStore = create<UIState>((set) => {
  // Helper to load from localStorage safely
  const getLocalStorageItem = (key: string, defaultValue: string) => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(key) || defaultValue;
    }
    return defaultValue;
  };

  const getLocalStorageNumber = (key: string, defaultValue: number) => {
    if (typeof window !== "undefined") {
      const val = localStorage.getItem(key);
      return val ? parseInt(val, 10) : defaultValue;
    }
    return defaultValue;
  };

  const getLocalStorageBoolean = (key: string, defaultValue: boolean) => {
    if (typeof window !== "undefined") {
      const val = localStorage.getItem(key);
      return val !== null ? val === "true" : defaultValue;
    }
    return defaultValue;
  };

  return {
    showCreateGuild: false,
    setShowCreateGuild: (show) => set({ showCreateGuild: show }),
    showJoinGuild: false,
    setShowJoinGuild: (show) => set({ showJoinGuild: show }),
    showInviteModal: false,
    setShowInviteModal: (show) => set({ showInviteModal: show }),
    showCreateChannel: false,
    setShowCreateChannel: (show) => set({ showCreateChannel: show }),
    showCreateDM: false,
    setShowCreateDM: (show) => set({ showCreateDM: show }),
    showSettings: false,
    setShowSettings: (show) => set({ showSettings: show }),
    settingsTab: "profile",
    setSettingsTab: (tab) => set({ settingsTab: tab }),
    showGuildSettings: false,
    setShowGuildSettings: (show) => set({ showGuildSettings: show }),
    guildSettingsTab: "roles",
    setGuildSettingsTab: (tab) => set({ guildSettingsTab: tab }),
    showChannelSettings: false,
    setShowChannelSettings: (show) => set({ showChannelSettings: show }),
    activeChannelSettingsId: null,
    setActiveChannelSettingsId: (id) => set({ activeChannelSettingsId: id }),

    channelSidebarCollapsed: getLocalStorageBoolean("synapse_channel_sidebar_collapsed", false),
    setChannelSidebarCollapsed: (collapsed) => {
      if (typeof window !== "undefined") {
        localStorage.setItem("synapse_channel_sidebar_collapsed", String(collapsed));
      }
      set({ channelSidebarCollapsed: collapsed });
    },
    membersSidebarCollapsed: getLocalStorageBoolean("synapse_members_sidebar_collapsed", false),
    setMembersSidebarCollapsed: (collapsed) => {
      if (typeof window !== "undefined") {
        localStorage.setItem("synapse_members_sidebar_collapsed", String(collapsed));
      }
      set({ membersSidebarCollapsed: collapsed });
    },

    mobileChannelsOpen: false,
    setMobileChannelsOpen: (open) => set({ mobileChannelsOpen: open }),
    mobileMembersOpen: false,
    setMobileMembersOpen: (open) => set({ mobileMembersOpen: open }),

    channelSidebarWidth: getLocalStorageNumber("synapse_channel_sidebar_width", 240),
    setChannelSidebarWidth: (width) => {
      if (typeof window !== "undefined") {
        localStorage.setItem("synapse_channel_sidebar_width", String(width));
      }
      set({ channelSidebarWidth: width });
    },
    membersSidebarWidth: getLocalStorageNumber("synapse_members_sidebar_width", 240),
    setMembersSidebarWidth: (width) => {
      if (typeof window !== "undefined") {
        localStorage.setItem("synapse_members_sidebar_width", String(width));
      }
      set({ membersSidebarWidth: width });
    },

    theme: getLocalStorageItem("synapse_theme", "dark") as ThemeType,
    setTheme: (theme) => {
      if (typeof window !== "undefined") {
        localStorage.setItem("synapse_theme", theme);
      }
      set({ theme });
    },
    fontSize: getLocalStorageItem("synapse_font_size", "normal") as FontSize,
    setFontSize: (size) => {
      if (typeof window !== "undefined") {
        localStorage.setItem("synapse_font_size", size);
      }
      set({ fontSize: size });
    },
    fontFamily: getLocalStorageItem("synapse_font_family", "geist") as FontFamily,
    setFontFamily: (family) => {
      if (typeof window !== "undefined") {
        localStorage.setItem("synapse_font_family", family);
      }
      set({ fontFamily: family });
    },
    messageDensity: getLocalStorageItem("synapse_message_density", "comfortable") as MessageDensity,
    setMessageDensity: (density) => {
      if (typeof window !== "undefined") {
        localStorage.setItem("synapse_message_density", density);
      }
      set({ messageDensity: density });
    },

    drafts: {},
    setDraft: (channelId, text) =>
      set((state) => ({
        drafts: { ...state.drafts, [channelId]: text },
      })),

    toast: null,
    showToast: (message, type = "info") => set({ toast: { message, type, id: Date.now() } }),
    hideToast: () => set({ toast: null }),
  };
});
