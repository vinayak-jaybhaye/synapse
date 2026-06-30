import { api } from "../../lib/api";
import { User, UserGuildDTO } from "../../types";

export interface AuthResponse {
  token: string;
  user: User;
}

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>("/auth/login", {
      email,
      password,
    });
    console.log(response.data);
    return response.data;
  },

  register: async (username: string, email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>("/auth/register", {
      username,
      email,
      password,
    });
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await api.get<User>("/users/@me");
    return response.data;
  },

  getMeGuilds: async (): Promise<UserGuildDTO[]> => {
    const response = await api.get<UserGuildDTO[]>("/users/@me/guilds");
    return response.data;
  },

  createDM: async (recipientId: string): Promise<{ channel_id: string; recipient_id: string }> => {
    const response = await api.post<{
      channel_id: string;
      recipient_id: string;
    }>("/dms", {
      recipient_id: recipientId,
    });
    return response.data;
  },
};
