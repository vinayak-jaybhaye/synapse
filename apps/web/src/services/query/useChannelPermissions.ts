import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { channelsApi } from "../api/channels";

export function useChannelPermissions(channelId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["channelPermissions", channelId];

  const query = useQuery({
    queryKey,
    queryFn: () => channelsApi.getChannelRolePermissions(channelId!),
    enabled: !!channelId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const updatePermission = useMutation({
    mutationFn: (data: {
      roleId: string;
      allow: string;
      deny: string;
    }) =>
      channelsApi.updateChannelRolePermission(
        channelId!,
        data.roleId,
        data.allow,
        data.deny
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deletePermission = useMutation({
    mutationFn: (roleId: string) =>
      channelsApi.deleteChannelRolePermission(channelId!, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    permissions: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    updatePermission: updatePermission.mutateAsync,
    deletePermission: deletePermission.mutateAsync,
  };
}
