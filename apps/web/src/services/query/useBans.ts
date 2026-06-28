import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { guildsApi } from "../api/guilds";
import { BanWithUser } from "../../types";

export const bansKeys = {
  all: ["bans"] as const,
  list: (guildId: string) => [...bansKeys.all, guildId] as const,
};

export function useBans(guildId?: string) {
  const queryClient = useQueryClient();

  const bansQuery = useQuery({
    queryKey: bansKeys.list(guildId || ""),
    queryFn: () => guildsApi.getBans(guildId!),
    enabled: !!guildId,
  });

  const unbanMutation = useMutation({
    mutationFn: (userId: string) => guildsApi.unbanMember(guildId!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bansKeys.list(guildId || "") });
    },
  });

  return {
    bans: bansQuery.data || [],
    isLoading: bansQuery.isLoading,
    error: bansQuery.error,
    unbanMember: unbanMutation.mutateAsync,
  };
}
