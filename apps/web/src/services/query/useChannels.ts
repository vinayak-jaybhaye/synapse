import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { channelsApi } from "../api/channels";

export const channelsKeys = {
  all: ["channels"] as const,
  list: (guildId: string) => [...channelsKeys.all, guildId] as const,
};

export function useChannels(guildId?: string) {
  const queryClient = useQueryClient();

  const channelsQuery = useQuery({
    queryKey: channelsKeys.list(guildId || ""),
    queryFn: () => channelsApi.getChannels(guildId!),
    enabled: !!guildId,
  });

  const createChannelMutation = useMutation({
    mutationFn: ({ name, type, topic }: { name: string; type: number; topic?: string }) =>
      channelsApi.createChannel(guildId!, name, type, topic),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelsKeys.list(guildId || "") });
    },
  });

  const updateChannelMutation = useMutation({
    mutationFn: ({ channelId, name, topic }: { channelId: string; name?: string; topic?: string }) =>
      channelsApi.updateChannel(channelId, { name, topic }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelsKeys.list(guildId || "") });
    },
  });

  const deleteChannelMutation = useMutation({
    mutationFn: (channelId: string) => channelsApi.deleteChannel(channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelsKeys.list(guildId || "") });
    },
  });

  return {
    channels: channelsQuery.data || [],
    isLoading: channelsQuery.isLoading,
    error: channelsQuery.error,
    createChannel: createChannelMutation.mutateAsync,
    updateChannel: updateChannelMutation.mutateAsync,
    deleteChannel: deleteChannelMutation.mutateAsync,
  };
}
