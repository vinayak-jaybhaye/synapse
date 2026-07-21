import { api } from "../../lib/api";

export interface NotificationSettings {
  user_id: string;
  guild_id?: string;
  channel_id?: string;
  level: number;
  muted_until?: string;
}

export interface NotificationModel {
  id: string;
  recipient_id: string;
  actor_id?: string;
  type: number;
  reference_type: number;
  reference_id: string;
  metadata?: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

export const notificationsApi = {
  getSettings: async (): Promise<NotificationSettings[]> => {
    const res = await api.get("/users/@me/notifications");
    return res.data;
  },
  putGlobalSettings: async (level: number, mutedUntil?: string): Promise<void> => {
    await api.put("/users/@me/notifications/global", { level, muted_until: mutedUntil });
  },
  putGuildSettings: async (guildId: string, level: number, mutedUntil?: string): Promise<void> => {
    await api.put(`/users/@me/notifications/guilds/${guildId}`, { level, muted_until: mutedUntil });
  },
  putChannelSettings: async (
    channelId: string,
    level: number,
    mutedUntil?: string,
  ): Promise<void> => {
    await api.put(`/users/@me/notifications/channels/${channelId}`, {
      level,
      muted_until: mutedUntil,
    });
  },
  getInbox: async (limit: number = 50, beforeId?: string): Promise<NotificationModel[]> => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (beforeId) params.append("before", beforeId);
    const res = await api.get(`/users/@me/notifications/inbox?${params.toString()}`);
    return res.data;
  },
  getUnreadCount: async (): Promise<{ count: number }> => {
    const res = await api.get("/users/@me/notifications/unread-count");
    return res.data;
  },
  markRead: async (id: string): Promise<void> => {
    await api.patch(`/users/@me/notifications/${id}/read`);
  },
  markAllRead: async (): Promise<void> => {
    await api.patch("/users/@me/notifications/read-all");
  },
  deleteNotification: async (id: string): Promise<void> => {
    await api.delete(`/users/@me/notifications/${id}`);
  },
};
