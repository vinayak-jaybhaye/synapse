import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../api/auth";
import { guildsApi } from "../api/guilds";
import { invitesApi } from "../api/invites";

export const GUILDS_QUERY_KEY = ["guilds"];

export function useGuilds() {
  const queryClient = useQueryClient();

  const guildsQuery = useQuery({
    queryKey: GUILDS_QUERY_KEY,
    queryFn: authApi.getMeGuilds,
  });

  const createGuildMutation = useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      guildsApi.createGuild(name, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GUILDS_QUERY_KEY });
    },
  });

  const joinGuildMutation = useMutation({
    mutationFn: (code: string) => invitesApi.joinGuild(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GUILDS_QUERY_KEY });
    },
  });

  return {
    guilds: guildsQuery.data || [],
    isLoading: guildsQuery.isLoading,
    error: guildsQuery.error,
    createGuild: createGuildMutation.mutateAsync,
    joinGuild: joinGuildMutation.mutateAsync,
  };
}
