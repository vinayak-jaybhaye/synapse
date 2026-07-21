import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDMs, createDM } from "../api/dms";
import { useAuthStore } from "../../store/auth-store";

export const useDMs = () => {
  const { isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: dms = [], isLoading } = useQuery({
    queryKey: ["dms"],
    queryFn: getDMs,
    enabled: isAuthenticated,
  });

  const { mutateAsync: mutateCreateDM } = useMutation({
    mutationFn: createDM,
    onSuccess: (newDM) => {
      queryClient.setQueryData(["dms"], (old: Array<{ channel_id: string }> | undefined) => {
        if (!old) return [newDM];
        // Don't add duplicate
        if (old.some((dm) => dm.channel_id === newDM.channel_id)) {
          return old;
        }
        return [newDM, ...old];
      });
    },
  });

  return {
    dms,
    isLoading,
    createDM: mutateCreateDM,
  };
};
