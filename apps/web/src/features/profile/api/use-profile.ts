import { useQuery } from "@tanstack/react-query";
import { usersApi } from "../../../services/api/users";

export const useUserProfile = (userId?: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["user-profile", userId],
    queryFn: () => {
      if (!userId) throw new Error("No user ID provided");
      return usersApi.getProfile(userId);
    },
    enabled: !!userId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
