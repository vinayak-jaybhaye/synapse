import { useMutation, useQuery } from "@tanstack/react-query";
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
