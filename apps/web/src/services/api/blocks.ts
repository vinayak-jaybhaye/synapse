import { api } from "../../lib/api";

export const blocksApi = {
  blockUser: async (userId: string): Promise<void> => {
    await api.post(`/users/@me/blocks/${userId}`);
  },

  unblockUser: async (userId: string): Promise<void> => {
    await api.delete(`/users/@me/blocks/${userId}`);
  },

  getBlockedUsers: async (): Promise<string[]> => {
    const response = await api.get("/users/@me/blocks");
    return response.data;
  },
};
