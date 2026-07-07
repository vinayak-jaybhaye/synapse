import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { messagesApi } from "../api/messages";
import { Message } from "../../types";

export const messagesKeys = {
  all: ["messages"] as const,
  list: (channelId: string) => [...messagesKeys.all, channelId] as const,
};

export function useMessages(channelId?: string) {
  const queryClient = useQueryClient();

  const messagesQuery = useInfiniteQuery({
    queryKey: messagesKeys.list(channelId || ""),
    queryFn: ({ pageParam }) =>
      messagesApi.getMessages(channelId!, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length === 0) return undefined;
      // The last element is the oldest message in DESC ordering, which acts as the cursor 'before'
      return lastPage[lastPage.length - 1].id;
    },
    enabled: !!channelId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: ({
      content,
      attachmentUploadIds,
      replyToMessageId,
    }: {
      content: string;
      attachmentUploadIds?: string[];
      replyToMessageId?: string;
    }) => messagesApi.sendMessage(channelId!, content, attachmentUploadIds, replyToMessageId),
    onSuccess: (newMsg) => {
      queryClient.setQueryData(messagesKeys.list(channelId || ""), (old: any) => {
        if (!old?.pages) return old;
        const exists = old.pages.some((page: any[]) => page.some((m: any) => m.id === newMsg.id));
        if (exists) {
          return {
            ...old,
            pages: old.pages.map((page: any[]) =>
              page.map((m: any) => (m.id === newMsg.id ? { ...m, ...newMsg } : m)),
            ),
          };
        }

        const lastPage = old.pages[0] || [];
        return {
          ...old,
          pages: [[newMsg, ...lastPage], ...old.pages.slice(1)],
        };
      });
    },
  });

  const editMessageMutation = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      messagesApi.editMessage(channelId!, messageId, content),
    onSuccess: (updatedMsg) => {
      queryClient.setQueryData(messagesKeys.list(channelId || ""), (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: Message[]) =>
            page.map((m) => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m)),
          ),
        };
      });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (messageId: string) => messagesApi.deleteMessage(channelId!, messageId),
    onSuccess: (_, messageId) => {
      queryClient.setQueryData(messagesKeys.list(channelId || ""), (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: Message[]) =>
            page.map((m) => (m.id === messageId ? { ...m, deleted: true, content: "" } : m)),
          ),
        };
      });
    },
  });

  const addReactionMutation = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      messagesApi.addReaction(channelId!, messageId, emoji),
  });

  const removeReactionMutation = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      messagesApi.removeReaction(channelId!, messageId, emoji),
  });

  // Flat list chronologically ordered (oldest first) for UI rendering
  const pages = messagesQuery.data?.pages || [];
  const allMessages = pages
    .slice()
    .reverse()
    .flatMap((page) => page.slice().reverse());

  return {
    messages: allMessages,
    fetchNextPage: messagesQuery.fetchNextPage,
    hasNextPage: messagesQuery.hasNextPage,
    isFetchingNextPage: messagesQuery.isFetchingNextPage,
    isLoading: messagesQuery.isLoading,
    isError: messagesQuery.isError,
    error: messagesQuery.error,
    sendMessage: sendMessageMutation.mutateAsync,
    editMessage: editMessageMutation.mutateAsync,
    deleteMessage: deleteMessageMutation.mutateAsync,
    addReaction: addReactionMutation.mutateAsync,
    removeReaction: removeReactionMutation.mutateAsync,
  };
}
