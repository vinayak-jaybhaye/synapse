import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { blocksApi } from "../api/blocks";
import { useBlockStore } from "@/store/block-store";

export const useBlockedUsers = () => {
  return useQuery({
    queryKey: ["blocked_users"],
    queryFn: async () => {
      const ids = await blocksApi.getBlockedUsers();
      useBlockStore.getState().setBlockedUserIds(ids);
      return ids;
    },
    staleTime: Infinity, // Rely on real-time events to update the store
  });
};

export const useBlockUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => blocksApi.blockUser(userId),
    onSuccess: (_, userId) => {
      useBlockStore.getState().addBlockedUser(userId);
      queryClient.invalidateQueries({ queryKey: ["blocked_users"] });
    },
  });
};

export const useUnblockUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => blocksApi.unblockUser(userId),
    onSuccess: (_, userId) => {
      useBlockStore.getState().removeBlockedUser(userId);
      queryClient.invalidateQueries({ queryKey: ["blocked_users"] });
    },
  });
};
