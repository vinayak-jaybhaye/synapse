import { api } from "../../lib/api";
import { UserProfile, UserSummary } from "../../types";

export const usersApi = {
  getProfile: async (userId: string): Promise<UserProfile> => {
    const response = await api.get(`/users/${userId}/profile`);
    return response.data;
  },

  updateProfile: async (payload: Record<string, unknown>) => {
    const response = await api.patch("/users/@me", payload);
    return response.data;
  },

  search: async (query: string): Promise<UserSummary[]> => {
    const response = await api.get("/users/search", { params: { q: query } });
    return response.data;
  },
};
