import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "../api/notifications";

export const notificationsKeys = {
  all: ["notifications"] as const,
  inbox: () => [...notificationsKeys.all, "inbox"] as const,
  unreadCount: () => [...notificationsKeys.all, "unreadCount"] as const,
  settings: () => [...notificationsKeys.all, "settings"] as const,
};

export function useInbox() {
  return useQuery({
    queryKey: notificationsKeys.inbox(),
    queryFn: () => notificationsApi.getInbox(50),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationsKeys.unreadCount(),
    queryFn: () => notificationsApi.getUnreadCount(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: (_, id) => {
      // Optimistically update the inbox list
      queryClient.setQueryData(notificationsKeys.inbox(), (old: any) => {
        if (!old) return old;
        return old.map((n: any) =>
          n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n,
        );
      });
      // Invalidate the unread count
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount() });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.setQueryData(notificationsKeys.inbox(), (old: any) => {
        if (!old) return old;
        const now = new Date().toISOString();
        return old.map((n: any) => ({ ...n, is_read: true, read_at: n.read_at || now }));
      });
      queryClient.setQueryData(notificationsKeys.unreadCount(), { count: 0 });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.deleteNotification,
    onSuccess: (_, id) => {
      queryClient.setQueryData(notificationsKeys.inbox(), (old: any) => {
        if (!old) return old;
        return old.filter((n: any) => n.id !== id);
      });
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount() });
    },
  });
}
