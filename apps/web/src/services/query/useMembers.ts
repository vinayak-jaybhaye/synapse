import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { guildsApi } from "../api/guilds";
import { rolesApi } from "../api/roles";

export const membersKeys = {
  all: ["members"] as const,
  list: (guildId: string) => [...membersKeys.all, guildId] as const,
};

export function useMembers(guildId?: string) {
  const queryClient = useQueryClient();

  const membersQuery = useQuery({
    queryKey: membersKeys.list(guildId || ""),
    queryFn: () => guildsApi.getGuildMembers(guildId!),
    enabled: !!guildId,
  });

  const infiniteQuery = useInfiniteQuery({
    queryKey: [...membersKeys.list(guildId || ""), "infinite"],
    queryFn: ({ pageParam = "" }) => guildsApi.getGuildMembers(guildId!, pageParam as string, 50),
    getNextPageParam: (lastPage) => {
      if (lastPage.length < 50) return undefined;
      return lastPage[lastPage.length - 1].user_id;
    },
    enabled: !!guildId,
    initialPageParam: "",
  });

  const patchMemberMutation = useMutation({
    mutationFn: ({ userId, nickname }: { userId: string; nickname?: string }) =>
      guildsApi.patchGuildMember(guildId!, userId, { nickname }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: membersKeys.list(guildId || ""),
      });
    },
  });

  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      rolesApi.assignRole(guildId!, userId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: membersKeys.list(guildId || ""),
      });
    },
  });

  const unassignRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      rolesApi.unassignRole(guildId!, userId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: membersKeys.list(guildId || ""),
      });
    },
  });

  return {
    members: membersQuery.data || [],
    isLoading: membersQuery.isLoading,
    error: membersQuery.error,
    infiniteMembers: infiniteQuery.data?.pages.flat() || [],
    infiniteError: infiniteQuery.error,
    infiniteIsLoading: infiniteQuery.isLoading,
    fetchNextPage: infiniteQuery.fetchNextPage,
    hasNextPage: infiniteQuery.hasNextPage,
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,
    updateMember: patchMemberMutation.mutateAsync,
    assignRole: assignRoleMutation.mutateAsync,
    unassignRole: unassignRoleMutation.mutateAsync,
  };
}
