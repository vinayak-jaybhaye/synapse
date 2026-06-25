import { api } from "../../lib/api";
import { Role } from "../../types";

export const rolesApi = {
  getRoles: async (guildId: string): Promise<Role[]> => {
    const response = await api.get<Role[]>(`/guilds/${guildId}/roles`);
    return response.data || [];
  },

  createRole: async (
    guildId: string,
    name: string,
    permissions: string,
    color?: number
  ): Promise<Role> => {
    const response = await api.post<Role>(`/guilds/${guildId}/roles`, {
      name,
      permissions,
      color,
    });
    return response.data;
  },

  updateRole: async (
    guildId: string,
    roleId: string,
    updates: Partial<Role>
  ): Promise<Role> => {
    const response = await api.patch<Role>(`/guilds/${guildId}/roles/${roleId}`, updates);
    return response.data;
  },

  deleteRole: async (guildId: string, roleId: string): Promise<void> => {
    await api.delete(`/guilds/${guildId}/roles/${roleId}`);
  },

  assignRole: async (guildId: string, userId: string, roleId: string): Promise<void> => {
    await api.put(`/guilds/${guildId}/members/${userId}/roles/${roleId}`);
  },

  unassignRole: async (guildId: string, userId: string, roleId: string): Promise<void> => {
    await api.delete(`/guilds/${guildId}/members/${userId}/roles/${roleId}`);
  },
};
