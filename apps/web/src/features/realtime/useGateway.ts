"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../store/auth-store";
import { gateway } from "./gateway";
import { GatewayEvent, GatewayOps } from "./events";
import { messagesKeys } from "../../services/query/useMessages";

import { channelsKeys } from "../../services/query/useChannels";
import { membersKeys } from "../../services/query/useMembers";
import { GUILDS_QUERY_KEY } from "../../services/query/useGuilds";
import { bansKeys } from "../../services/query/useBans";
import { notificationsKeys } from "../../services/query/useNotifications";
import { Message } from "../../types";
import { useVoiceStore } from "../voice/voiceStore";
import { useUIStore } from "../../store/ui-store";
import { useTypingStore } from "../../store/typing-store";
import { usePresenceStore } from "../../store/presence-store";
import { useGuildStore } from "../../store/guild-store";

/**
 * Hook that connects the gateway to React Query's cache and voice store.
 *
 * When a realtime event arrives, it updates the relevant query cache
 * or voice store directly — no refetch needed.
 *
 * Usage: Mount once in Providers.tsx or the authenticated layout.
 */
export function useGateway() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const handlerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      gateway.disconnect();
      return;
    }

    gateway.connect("");

    // Reset hydration state on connect/reconnect
    const unsubscribeState = gateway.onStateChange((state) => {
      if (state === "connected") {
        useGuildStore.getState().resetHydration();
      }
    });

    // Subscribe to gateway events and route them to query cache / voice store
    const unsubscribe = gateway.onEvent((event: GatewayEvent) => {
      console.log("[Gateway Hook Received Event]", event);
      if (event.op !== GatewayOps.DISPATCH) return;

      switch (event.t) {
        case "MESSAGE_CREATE": {
          const msg = event.d as any;
          queryClient.setQueryData(messagesKeys.list(String(msg.channel_id)), (old: any) => {
            if (!old?.pages) return old;

            const exists = old.pages.some((page: any[]) => page.some((m: any) => m.id === msg.id));
            if (exists) {
              return {
                ...old,
                pages: old.pages.map((page: any[]) =>
                  page.map((m: any) => (m.id === msg.id ? { ...m, ...msg } : m)),
                ),
              };
            }

            const lastPage = old.pages[0] || [];
            return {
              ...old,
              pages: [[msg, ...lastPage], ...old.pages.slice(1)],
            };
          });
          break;
        }

        case "MESSAGE_UPDATE": {
          const msg = event.d as any;
          queryClient.setQueryData(messagesKeys.list(String(msg.channel_id)), (old: any) => {
            if (!old?.pages) return old;
            return {
              ...old,
              pages: old.pages.map((page: Message[]) =>
                page.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)),
              ),
            };
          });
          break;
        }

        case "MESSAGE_DELETE": {
          const { id, channel_id } = event.d as any;
          queryClient.setQueryData(messagesKeys.list(String(channel_id)), (old: any) => {
            if (!old?.pages) return old;
            return {
              ...old,
              pages: old.pages.map((page: Message[]) =>
                page.map((m) => (m.id === id ? { ...m, deleted: true, content: "" } : m)),
              ),
            };
          });
          break;
        }

        case "MESSAGE_REACTION_ADD": {
          const { message_id, channel_id, user_id, emoji } = event.d as any;
          const currentUserId = useAuthStore.getState().user?.id;
          const isMe = !!(currentUserId && user_id === currentUserId);
          queryClient.setQueryData(messagesKeys.list(String(channel_id)), (old: any) => {
            if (!old?.pages) return old;
            return {
              ...old,
              pages: old.pages.map((page: Message[]) =>
                page.map((m) => {
                  if (m.id === message_id) {
                    const reactions = m.reactions || [];
                    const existing = reactions.find((r) => r.emoji === emoji);
                    return {
                      ...m,
                      reactions: existing
                        ? reactions.map((r) =>
                            r.emoji === emoji ? { ...r, count: r.count + 1, me: r.me || isMe } : r,
                          )
                        : [...reactions, { emoji, count: 1, me: isMe }],
                    };
                  }
                  return m;
                }),
              ),
            };
          });
          break;
        }

        case "MESSAGE_REACTION_REMOVE": {
          const { message_id, channel_id, user_id, emoji } = event.d as any;
          const currentUserId = useAuthStore.getState().user?.id;
          const isMe = !!(currentUserId && user_id === currentUserId);
          queryClient.setQueryData(messagesKeys.list(String(channel_id)), (old: any) => {
            if (!old?.pages) return old;
            return {
              ...old,
              pages: old.pages.map((page: Message[]) =>
                page.map((m) => {
                  if (m.id === message_id) {
                    const reactions = m.reactions || [];
                    const existing = reactions.find((r) => r.emoji === emoji);
                    if (existing) {
                      const updatedReactions = reactions
                        .map((r) =>
                          r.emoji === emoji
                            ? { ...r, count: r.count - 1, me: isMe ? false : r.me }
                            : r,
                        )
                        .filter((r) => r.count > 0);
                      return { ...m, reactions: updatedReactions };
                    }
                  }
                  return m;
                }),
              ),
            };
          });
          break;
        }

        case "CHANNEL_CREATE": {
          const data = event.d as any;
          const guildId = data.guild_id;
          if (guildId) {
            queryClient.invalidateQueries({
              queryKey: channelsKeys.list(String(guildId)),
            });
          }
          break;
        }

        case "CHANNEL_UPDATE":
        case "CHANNEL_DELETE": {
          const data = event.d as any;
          const guildId = data.guild_id;
          if (guildId) {
            queryClient.invalidateQueries({
              queryKey: channelsKeys.list(String(guildId)),
            });
          }
          break;
        }

        case "GUILD_MEMBER_ADD":
        case "GUILD_MEMBER_REMOVE":
        case "GUILD_MEMBER_UPDATE": {
          const data = event.d as any;
          const guildId = data.guild_id;
          if (guildId) {
            queryClient.invalidateQueries({
              queryKey: membersKeys.list(String(guildId)),
            });
          }
          break;
        }

        case "GUILD_UPDATE": {
          queryClient.invalidateQueries({
            queryKey: GUILDS_QUERY_KEY,
          });
          break;
        }

        case "USER_DM_CREATE": {
          queryClient.invalidateQueries({
            queryKey: ["dms"],
          });
          break;
        }

        case "NOTIFICATION_CREATED":
        case "NOTIFICATION_UPDATED":
        case "NOTIFICATION_DELETED": {
          queryClient.invalidateQueries({ queryKey: notificationsKeys.inbox() });
          queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount() });
          break;
        }

        case "USER_BLOCK_ADD": {
          const data = event.d as any;
          if (data.blocked_id) {
            import("../../store/block-store").then(({ useBlockStore }) => {
              useBlockStore.getState().addBlockedUser(data.blocked_id);
            });
          }
          break;
        }

        case "USER_BLOCK_REMOVE": {
          const data = event.d as any;
          if (data.blocked_id) {
            import("../../store/block-store").then(({ useBlockStore }) => {
              useBlockStore.getState().removeBlockedUser(data.blocked_id);
            });
          }
          break;
        }

        case "GUILD_BAN_ADD": {
          const data = event.d as any;
          const guildId = data.guild_id;
          if (guildId) {
            queryClient.invalidateQueries({
              queryKey: bansKeys.list(String(guildId)),
            });
          }
          break;
        }

        case "VOICE_STATE_UPDATE": {
          const eventData = event.d as any;
          // Route to voice store statically — never sets `speaking` (LiveKit-local only)
          useVoiceStore.getState().updateFromGatewayEvent(eventData);

          // If the leave event is for the local user, we were kicked/ejected!
          const { state, action } = eventData;
          const localUser = useAuthStore.getState().user;
          if (action === "leave" && localUser && state && state.user_id === localUser.id) {
            const activeRoom = useVoiceStore.getState().room;
            if (activeRoom) {
              console.warn(
                "[Gateway] Local user evicted from voice channel; disconnecting local WebRTC room.",
              );
              activeRoom.disconnect();
              useVoiceStore.getState().clearActive();
              useUIStore
                .getState()
                .showToast("Ejected from the voice channel by a moderator.", "error");
            }
          }
          break;
        }

        case "TYPING_START": {
          const { channel_id, user_id } = event.d as any;
          const currentUserId = useAuthStore.getState().user?.id;
          if (currentUserId && user_id === currentUserId) break;
          useTypingStore.getState().setTyping(channel_id, user_id);
          break;
        }

        case "PRESENCE_UPDATE": {
          const { user_id, status } = event.d as any;
          usePresenceStore.getState().setStatus(user_id, status);
          break;
        }

        case "GUILD_PRESENCE_BULK": {
          const { guild_id, presences } = event.d as any;
          const store = usePresenceStore.getState();
          presences.forEach((p: any) => {
            store.setStatus(p.user_id, p.status);
          });
          useGuildStore.getState().setGuildHydration(guild_id, "hydrated");
          break;
        }

        default:
          break;
      }
    });

    handlerRef.current = unsubscribe;

    return () => {
      unsubscribe();
      unsubscribeState();
      gateway.disconnect();
    };
  }, [isAuthenticated, queryClient]);
}
