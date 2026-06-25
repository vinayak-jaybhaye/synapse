import { api } from "../../lib/api";
import { UserProfile } from "../../types";

export const usersApi = {
  getProfile: async (userId: string): Promise<UserProfile> => {
    const response = await api.get(`/users/${userId}/profile`);
    return response.data;
  },
  
  updateProfile: async (payload: any) => {
    const response = await api.patch('/users/@me', payload);
    return response.data;
  },
};
