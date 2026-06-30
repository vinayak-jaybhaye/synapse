import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rolesApi } from "../api/roles";
import { Role } from "../../types";

export const rolesKeys = {
  all: ["roles"] as const,
  list: (guildId: string) => [...rolesKeys.all, guildId] as const,
};

export function useRoles(guildId?: string) {
  const queryClient = useQueryClient();

  const rolesQuery = useQuery({
    queryKey: rolesKeys.list(guildId || ""),
    queryFn: () => rolesApi.getRoles(guildId!),
    enabled: !!guildId,
  });

  const createRoleMutation = useMutation({
    mutationFn: ({
      name,
      permissions,
      color,
    }: {
      name: string;
      permissions: string;
      color?: number;
    }) => rolesApi.createRole(guildId!, name, permissions, color),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rolesKeys.list(guildId || ""),
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ roleId, updates }: { roleId: string; updates: Partial<Role> }) =>
      rolesApi.updateRole(guildId!, roleId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rolesKeys.list(guildId || ""),
      });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (roleId: string) => rolesApi.deleteRole(guildId!, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rolesKeys.list(guildId || ""),
      });
    },
  });

  return {
    roles: rolesQuery.data || [],
    isLoading: rolesQuery.isLoading,
    error: rolesQuery.error,
    createRole: createRoleMutation.mutateAsync,
    updateRole: updateRoleMutation.mutateAsync,
    deleteRole: deleteRoleMutation.mutateAsync,
  };
}
