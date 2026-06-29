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
          queryClient.setQueryData(
            messagesKeys.list(msg.channel_id),
            (old: any) => {
              if (!old?.pages) return old;
              const lastPage = old.pages[0] || [];
              return {
                ...old,
                pages: [[msg, ...lastPage], ...old.pages.slice(1)],
              };
            }
          );
          break;
        }

        case "MESSAGE_UPDATE": {
          const msg = event.data;
          queryClient.setQueryData(
            messagesKeys.list(msg.channel_id),
            (old: any) => {
              if (!old?.pages) return old;
              return {
                ...old,
                pages: old.pages.map((page: Message[]) =>
                  page.map((m) => (m.id === msg.id ? msg : m))
                ),
              };
            }
          );
          break;
        }

        case "MESSAGE_DELETE": {
          const { id, channel_id } = event.data;
          queryClient.setQueryData(
            messagesKeys.list(channel_id),
            (old: any) => {
              if (!old?.pages) return old;
              return {
                ...old,
                pages: old.pages.map((page: Message[]) =>
                  page.map((m) =>
                    m.id === id ? { ...m, deleted: true, content: "" } : m
                  )
                ),
              };
            }
          );
          break;
        }

        case "CHANNEL_CREATE":
        case "CHANNEL_UPDATE":
        case "CHANNEL_DELETE": {
          const guildId = "guild_id" in event.data ? event.data.guild_id : undefined;
          if (guildId) {
            queryClient.invalidateQueries({ queryKey: channelsKeys.list(guildId) });
          }
          break;
        }

        case "MEMBER_JOIN":
        case "MEMBER_LEAVE":
        case "MEMBER_UPDATE": {
          const guildId = "guild_id" in event.data ? event.data.guild_id : undefined;
          if (guildId) {
            queryClient.invalidateQueries({ queryKey: membersKeys.list(guildId) });
          }
          break;
        }

        case "VOICE_STATE_UPDATE": {
          // Route to voice store — never sets `speaking` (LiveKit-local only)
          voiceStore.updateFromGatewayEvent(event.data);
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
