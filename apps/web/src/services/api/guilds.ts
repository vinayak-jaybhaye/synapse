import { api } from "../../lib/api";
import { Guild, Member } from "../../types";

export const guildsApi = {
  createGuild: async (name: string, description?: string): Promise<Guild> => {
    const response = await api.post<Guild>("/guilds", { name, description });
    return response.data;
  },

  getGuild: async (guildId: string): Promise<Guild> => {
    const response = await api.get<Guild>(`/guilds/${guildId}`);
    return response.data;
  },

  updateGuild: async (guildId: string, payload: any): Promise<Guild> => {
    const response = await api.patch<Guild>(`/guilds/${guildId}`, payload);
    return response.data;
  },

  getGuildMembers: async (guildId: string, after: string = "", limit: number = 50): Promise<Member[]> => {
    const query = new URLSearchParams();
    if (after) query.append("after", after);
    if (limit) query.append("limit", limit.toString());

    const response = await api.get<Member[]>(`/guilds/${guildId}/members?${query.toString()}`);
    return response.data || [];
  },

  patchGuildMember: async (
    guildId: string,
    userId: string,
    data: { nickname?: string }
  ): Promise<Member> => {
    const response = await api.patch<Member>(`/guilds/${guildId}/members/${userId}`, data);
    return response.data;
  },
};
