import { api } from "../../lib/api";
import { InviteDetails } from "../../types";

export const invitesApi = {
  createInvite: async (
    guildId: string,
    maxUses?: number,
    duration?: number
  ): Promise<{ code: string }> => {
    const response = await api.post<{ code: string }>(`/guilds/${guildId}/invites`, {
      max_uses: maxUses,
      duration,
    });
    return response.data;
  },

  getInvite: async (code: string): Promise<InviteDetails> => {
    const response = await api.get<InviteDetails>(`/invites/${code}`);
    return response.data;
  },

  joinGuild: async (code: string): Promise<{ guild_id: string }> => {
    const response = await api.post<{ guild_id: string }>(`/invites/${code}/join`);
    return response.data;
  },
};
