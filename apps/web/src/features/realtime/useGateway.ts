"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../store/auth-store";
import { gateway } from "./gateway";
import { GatewayEvent } from "./types";
import { messagesKeys } from "../../services/query/useMessages";
import { channelsKeys } from "../../services/query/useChannels";
import { membersKeys } from "../../services/query/useMembers";
import { Message } from "../../types";
import { useVoiceStore } from "../voice/voiceStore";
import { useUIStore } from "../../store/ui-store";

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
  const token = useAuthStore((s) => s.token);
  const handlerRef = useRef<(() => void) | null>(null);
  const voiceStore = useVoiceStore();

  useEffect(() => {
    if (!token) {
      gateway.disconnect();
      return;
    }

    gateway.connect(token);

    // Subscribe to gateway events and route them to query cache / voice store
    const unsubscribe = gateway.onEvent((event: GatewayEvent) => {
      switch (event.type) {
        case "MESSAGE_CREATE": {
          const msg = event.data;
          queryClient.setQueryData(messagesKeys.list(msg.channel_id), (old: any) => {
            if (!old?.pages) return old;
            const lastPage = old.pages[0] || [];
            return {
              ...old,
              pages: [[msg, ...lastPage], ...old.pages.slice(1)],
            };
          });
          break;
        }

        case "MESSAGE_UPDATE": {
          const msg = event.data;
          queryClient.setQueryData(messagesKeys.list(msg.channel_id), (old: any) => {
            if (!old?.pages) return old;
            return {
              ...old,
              pages: old.pages.map((page: Message[]) =>
                page.map((m) => (m.id === msg.id ? msg : m)),
              ),
            };
          });
          break;
        }

        case "MESSAGE_DELETE": {
          const { id, channel_id } = event.data;
          queryClient.setQueryData(messagesKeys.list(channel_id), (old: any) => {
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

        case "CHANNEL_CREATE":
        case "CHANNEL_UPDATE":
        case "CHANNEL_DELETE": {
          const guildId = "guild_id" in event.data ? event.data.guild_id : undefined;
          if (guildId) {
            queryClient.invalidateQueries({
              queryKey: channelsKeys.list(guildId),
            });
          }
          break;
        }

        case "MEMBER_JOIN":
        case "MEMBER_LEAVE":
        case "MEMBER_UPDATE": {
          const guildId = "guild_id" in event.data ? event.data.guild_id : undefined;
          if (guildId) {
            queryClient.invalidateQueries({
              queryKey: membersKeys.list(guildId),
            });
          }
          break;
        }

        case "VOICE_STATE_UPDATE": {
          const eventData = event.data;
          // Route to voice store — never sets `speaking` (LiveKit-local only)
          voiceStore.updateFromGatewayEvent(eventData);

          // If the leave event is for the local user, we were kicked/ejected!
          const { state, action } = eventData;
          const localUser = useAuthStore.getState().user;
          if (action === "leave" && localUser && state && state.user_id === localUser.id) {
            const activeRoom = voiceStore.room;
            if (activeRoom) {
              console.warn(
                "[Gateway] Local user evicted from voice channel; disconnecting local WebRTC room.",
              );
              activeRoom.disconnect();
              voiceStore.clearActive();
              useUIStore
                .getState()
                .showToast("Ejected from the voice channel by a moderator.", "error");
            }
          }
          break;
        }

        default:
          break;
      }
    });

    handlerRef.current = unsubscribe;

    return () => {
      unsubscribe();
      gateway.disconnect();
    };
  }, [token, queryClient]);
}
