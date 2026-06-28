"use client";

import React, { useEffect, useRef, useState } from "react";
import { useChannelStore } from "../../store/channel-store";
import { useGuildStore } from "../../store/guild-store";
import { useMessages } from "../../services/query/useMessages";
import { useChannels } from "../../services/query/useChannels";
import { useGuilds } from "../../services/query/useGuilds";
import { useDMs } from "../../services/query/useDMs";
import { Hash, Volume2, MessageSquare, Loader2, ArrowDown, AtSign } from "lucide-react";
import MessageItem from "./MessageItem";
import { getMediaUrl } from "../../lib/media";
import MessageComposer from "./MessageComposer";
import { useChannelPermissions } from "../../hooks/usePermissions";
import { Message, PermissionFlags, hasPermission } from "../../types";

export default function ChatArea() {
  const { activeChannelId } = useChannelStore();
  const { activeGuildId } = useGuildStore();
  const { guilds } = useGuilds();
  const { channels } = useChannels(activeGuildId || undefined);
  const { dms } = useDMs();

  const activeGuild = guilds.find((g) => g.id === activeGuildId);
  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const activeDM = (dms || []).find((d) => d.channel_id === activeChannelId);
  const { canManageMessages, canAddReactions } = useChannelPermissions(activeChannel?.permissions, !!activeDM);

  useEffect(() => {
    if (!activeGuild && !activeChannel) return;
    
    const printPerms = (name: string, permString: string | undefined) => {
      if (!permString) return;
      const results: Record<string, string> = {};
      for (const [key, value] of Object.entries(PermissionFlags)) {
        results[key] = hasPermission(permString, value) ? "YES" : "NO";
      }
      console.table(results);
    };

    printPerms("Guild", activeGuild?.permissions);
    if (activeChannel) {
      printPerms("Channel", activeChannel?.permissions);
    }
  }, [activeGuild?.permissions, activeChannel?.permissions]);

  const {
    messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
  } = useMessages(activeChannelId || undefined);

  const scrollRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);

  // 1. Infinite scroll: intersection observer at top of list
  useEffect(() => {
    const observerTarget = observerRef.current;
    if (!observerTarget || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          // Store height before fetching older messages to maintain scroll position
          const container = scrollRef.current;
          const previousScrollHeight = container ? container.scrollHeight : 0;

          fetchNextPage().then(() => {
            requestAnimationFrame(() => {
              if (container) {
                // Adjust scroll position to prevent jumping
                container.scrollTop = container.scrollHeight - previousScrollHeight;
              }
            });
          });
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(observerTarget);
    return () => {
      observer.unobserve(observerTarget);
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, messages.length]);

  // 2. Scroll to bottom helper
  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // 3. Scroll to bottom on channel change
  useEffect(() => {
    setReplyTarget(null);
    if (activeChannelId) {
      scrollToBottom();
      // Second tick to account for loading DOM elements
      setTimeout(scrollToBottom, 80);
    }
  }, [activeChannelId]);

  // 4. Scroll anchor: scroll to bottom on new message if already near bottom
  const prevMsgLength = useRef(messages.length);
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 150;

    if (messages.length > prevMsgLength.current) {
      if (isNearBottom) {
        scrollToBottom("smooth");
      } else {
        setShowScrollBottomBtn(true);
      }
    }
    prevMsgLength.current = messages.length;
  }, [messages.length]);

  // Handle scroll events to toggle scroll-to-bottom indicator button
  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;

    const scrolledUp =
      container.scrollHeight - container.scrollTop - container.clientHeight > 300;
    setShowScrollBottomBtn(scrolledUp);
  };

  const handleSend = async (content: string, uploadIds?: string[]) => {
    try {
      await sendMessage({ content, attachmentUploadIds: uploadIds, replyToMessageId: replyTarget?.id });
      setReplyTarget(null);
      scrollToBottom("smooth");
    } catch (err) {
      console.error(err);
    }
  };

  if (!activeChannelId || (!activeChannel && !activeDM)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-text-muted gap-3 h-full bg-bg-primary">
        <div className="h-16 w-16 rounded-full bg-bg-secondary flex items-center justify-center font-bold text-text-muted text-2xl select-none">
          💬
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">Welcome to Synapse!</h2>
          <p className="text-sm mt-1 max-w-sm">
            Select a channel from the left sidebar to start collaborating.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-bg-primary relative">
      {/* 1. Header */}
      <div className="h-12 border-b border-border-custom px-4 flex items-center justify-between shrink-0 shadow-sm z-10 bg-bg-primary">
        <div className="flex items-center gap-2">
          {activeDM ? (
            <AtSign className="h-5 w-5 text-text-muted" />
          ) : activeChannel?.type === 1 ? (
            <Volume2 className="h-5 w-5 text-text-muted" />
          ) : (
            <Hash className="h-5 w-5 text-text-muted" />
          )}
          <span className="font-bold text-text-primary">
            {activeDM 
              ? activeDM.recipient.display_name || activeDM.recipient.username 
              : activeChannel?.name}
          </span>
          {activeChannel?.topic && (
            <>
              <div className="w-px h-4 bg-border-custom mx-1" />
              <span className="text-sm font-medium text-text-secondary truncate max-w-sm">
                {activeChannel.topic}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4 text-text-secondary">
          {/* Header Actions (Search, Pinned Messages, etc.) placeholder */}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-6 relative"
        role="region"
        aria-label={`Messages in ${activeDM ? activeDM.recipient.username : activeChannel?.name}`}
      >
        {/* Infinite Scroll Top Trigger */}
        {hasNextPage && (
          <div ref={observerRef} className="h-8 flex items-center justify-center py-2">
            {isFetchingNextPage ? (
              <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
            ) : (
              <span className="text-[10px] text-text-muted">Load more history</span>
            )}
          </div>
        )}

        {/* Start of channel banner banner */}
        {!hasNextPage && !isLoading && (
          <div className="flex flex-col gap-1.5 pb-6 border-b border-border-custom/40">
            {activeDM ? (
              <>
                <div className="h-20 w-20 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-white text-3xl select-none mb-2 overflow-hidden">
                  {activeDM.recipient.avatar_key ? (
                    <img src={getMediaUrl(activeDM.recipient.avatar_key)} alt={activeDM.recipient.username} className="w-full h-full object-cover" />
                  ) : (
                    (activeDM.recipient.display_name || activeDM.recipient.username).charAt(0).toUpperCase()
                  )}
                </div>
                <h2 className="text-2xl font-bold text-text-primary">
                  {activeDM.recipient.display_name || activeDM.recipient.username}
                </h2>
                <h3 className="text-lg font-medium text-text-muted mb-1">
                  {activeDM.recipient.username}
                </h3>
                <p className="text-text-secondary text-sm">
                  This is the beginning of your direct message history with <span className="font-semibold text-text-primary">@{activeDM.recipient.username}</span>.
                </p>
              </>
            ) : (
              <>
                <div className="h-16 w-16 rounded-full bg-bg-secondary flex items-center justify-center font-bold text-text-primary text-3xl select-none mb-2">
                  {activeChannel?.type === 1 ? <Volume2 className="h-8 w-8" /> : <Hash className="h-8 w-8" />}
                </div>
                <h2 className="text-2xl font-bold text-text-primary">
                  Welcome to #{activeChannel?.name}!
                </h2>
                <p className="text-text-secondary text-sm">
                  This is the start of the #{activeChannel?.name} channel.
                </p>
              </>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {messages.map((msg) => (
              <MessageItem
                key={msg.id}
                msg={msg}
                onReply={() => setReplyTarget(msg)}
                onEdit={async (messageId, content) => {
                  await editMessage({ messageId, content });
                }}
                onDelete={async (messageId) => {
                  await deleteMessage(messageId);
                }}
                onAddReaction={async (messageId, emoji) => {
                  await addReaction({ messageId, emoji });
                }}
                onRemoveReaction={async (messageId, emoji) => {
                  await removeReaction({ messageId, emoji });
                }}
                canManageMessages={canManageMessages}
                canAddReactions={canAddReactions}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Scroll to Bottom Indicator */}
      {showScrollBottomBtn && (
        <button
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-20 right-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-2.5 shadow-lg border border-indigo-500 flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 z-20"
          title="Scroll to bottom"
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}

      {/* Message Composer & Reply Target Bar */}
      <div className="shrink-0 bg-bg-primary z-10">
        {replyTarget && (
          <div className="bg-bg-secondary border border-border-custom border-b-0 rounded-t-xl px-4 py-2 flex items-center justify-between text-xs text-text-secondary">
            <div className="flex items-center gap-1.5 truncate">
              <span>Replying to</span>
              <span className="font-semibold text-text-primary">
                @{replyTarget.author_id.substring(0, 5)}
              </span>
              <span className="truncate italic">"{replyTarget.content || "deleted message"}"</span>
            </div>
            <button
              onClick={() => setReplyTarget(null)}
              className="text-text-muted hover:text-text-primary p-0.5 rounded cursor-pointer"
              aria-label="Cancel reply"
            >
              ✕
            </button>
          </div>
        )}
        <div className="px-4 pb-4 bg-bg-primary">
          <MessageComposer
            channelId={activeChannelId}
            placeholder={`Message ${activeDM ? `@${activeDM.recipient.username}` : `#${activeChannel?.name}`}`}
            onSend={handleSend}
            draftKey={activeChannelId}
            permissions={activeDM ? undefined : activeChannel?.permissions}
            isDM={!!activeDM}
          />
        </div>
      </div>
    </div>
  );
}
