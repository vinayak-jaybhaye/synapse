import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invitesApi } from "../api/invites";

export const invitesKeys = {
  all: ["invites"] as const,
  detail: (code: string) => [...invitesKeys.all, code] as const,
};

/**
 * Hook for creating invites (mutation only).
 */
export function useCreateInvite() {
  const createInviteMutation = useMutation({
    mutationFn: ({
      guildId,
      maxUses,
      duration,
    }: {
      guildId: string;
      maxUses?: number;
      duration?: number;
    }) => invitesApi.createInvite(guildId, maxUses, duration),
  });

  return {
    createInvite: createInviteMutation.mutateAsync,
    isCreating: createInviteMutation.isPending,
  };
}

/**
 * Hook for fetching invite details by code.
 * Must be called at the top level of a component (not inside callbacks).
 */
export function useInviteDetails(code: string | undefined) {
  return useQuery({
    queryKey: invitesKeys.detail(code || ""),
    queryFn: () => invitesApi.getInvite(code!),
    enabled: !!code,
  });
}

export function useGuildInvites(guildId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["guild", guildId, "invites"],
    queryFn: () => invitesApi.getGuildInvites(guildId!),
    enabled: Boolean(guildId),
  });

  const deleteInviteMutation = useMutation({
    mutationFn: (code: string) => invitesApi.deleteInvite(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guild", guildId, "invites"] });
    },
  });

  return {
    invites: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    deleteInvite: deleteInviteMutation.mutateAsync,
    isDeleting: deleteInviteMutation.isPending,
  };
}
