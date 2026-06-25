import { api } from "../../lib/api";
import { Channel } from "../../types";

export const channelsApi = {
  getChannels: async (guildId: string): Promise<Channel[]> => {
    const response = await api.get<Channel[]>(`/guilds/${guildId}/channels`);
    return response.data || [];
  },

  createChannel: async (
    guildId: string,
    name: string,
    type: number,
    topic?: string
  ): Promise<Channel> => {
    const response = await api.post<Channel>(`/guilds/${guildId}/channels`, {
      name,
      type,
      topic,
    });
    return response.data;
  },

  updateChannel: async (
    channelId: string,
    data: { name?: string; topic?: string }
  ): Promise<Channel> => {
    const response = await api.patch<Channel>(`/channels/${channelId}`, data);
    return response.data;
  },

  deleteChannel: async (channelId: string): Promise<void> => {
    await api.delete(`/channels/${channelId}`);
  },

  getChannelRolePermissions: async (
    channelId: string
  ): Promise<import("../../types").ChannelRolePermissionOverride[]> => {
    const response = await api.get<import("../../types").ChannelRolePermissionOverride[]>(
      `/channels/${channelId}/permissions`
    );
    return response.data || [];
  },

  updateChannelRolePermission: async (
    channelId: string,
    roleId: string,
    allow_permissions: string,
    deny_permissions: string
  ): Promise<void> => {
    await api.put(`/channels/${channelId}/permissions/${roleId}`, {
      allow_permissions,
      deny_permissions,
    });
  },

  deleteChannelRolePermission: async (
    channelId: string,
    roleId: string
  ): Promise<void> => {
    await api.delete(`/channels/${channelId}/permissions/${roleId}`);
  },
};
