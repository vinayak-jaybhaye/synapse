/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuthStore } from "../../store/auth-store";
import { Message } from "../../types";
import { formatTimestamp } from "../../lib/utils";
import { getMediaUrl } from "../../lib/media";
import { normalizeError } from "../../lib/api";
import { useUIStore } from "../../store/ui-store";
import { useMessageRegistry } from "../../store/message-registry";

import MessageContent from "./MessageContent";
import MessageActions from "./MessageActions";
import MessageReactions from "./MessageReactions";
import MessageEditForm from "./MessageEditForm";
import MessageReplyPreview from "./MessageReplyPreview";
import UserProfilePopover from "../../features/profile/components/UserProfilePopover";

interface MessageItemProps {
  msg: Message;
  onReply: () => void;
  onEdit: (messageId: string, content: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  onAddReaction: (messageId: string, emoji: string) => Promise<void>;
  onRemoveReaction: (messageId: string, emoji: string) => Promise<void>;
  canManageMessages?: boolean;
  canAddReactions?: boolean;
}

export default React.memo(function MessageItem({
  msg,
  onReply,
  onEdit,
  onDelete,
  onAddReaction,
  onRemoveReaction,
  canManageMessages = false,
  canAddReactions = true,
}: MessageItemProps) {
  const { user } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const { register, unregister, highlightedMessageId } = useMessageRegistry();
  const itemRef = useRef<HTMLDivElement>(null);

  // Register DOM node for jump-to-message
  useEffect(() => {
    if (itemRef.current) {
      register(msg.id, itemRef.current);
    }
    return () => {
      unregister(msg.id);
    };
  }, [msg.id, register, unregister]);

  const isAuthor = msg.author.id === user?.id || msg.author_id === user?.id;
  const initials = msg.author.username
    ? msg.author.username.substring(0, 1).toUpperCase()
    : `M${msg.author_id.substring(0, 1).toUpperCase()}`;
  const timestamp = formatTimestamp(msg.created_at);
  const isHighlighted = highlightedMessageId === msg.id;

  const handleEditSubmit = async (content: string) => {
    try {
      await onEdit(msg.id, content);
      setIsEditing(false);
    } catch (err) {
      useUIStore.getState().showToast(normalizeError(err).message, "error");
    }
  };

  return (
    <div
      ref={itemRef}
      className={`flex gap-msg-gap group hover:bg-bg-secondary/40 -mx-4 px-4 py-msg-pad rounded-lg transition-colors duration-75 relative ${
        isHighlighted ? "animate-message-highlight" : ""
      }`}
    >
      {/* Avatar */}
      <UserProfilePopover userId={msg.author_id} side="right" align="start">
        <button className="shrink-0 h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-white text-sm select-none mt-0.5 overflow-hidden hover:opacity-80 transition-opacity focus:outline-none">
          {msg.author?.avatar_key ? (
            <img
              src={getMediaUrl(msg.author.avatar_key)}
              alt={msg.author.username}
              className="w-full h-full object-cover"
            />
          ) : (
            initials
          )}
        </button>
      </UserProfilePopover>

      {/* Message Details */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Reply Preview */}
        {msg.reply_preview && <MessageReplyPreview replyPreview={msg.reply_preview} />}

        <div className="flex items-baseline gap-2">
          <UserProfilePopover userId={msg.author_id} side="right" align="start">
            <button className="font-semibold text-text-primary hover:underline cursor-pointer text-sm focus:outline-none">
              {msg.author.display_name ||
                msg.author.username ||
                `Member ID:${msg.author_id.substring(0, 5)}`}
            </button>
          </UserProfilePopover>
          <span className="text-[10px] text-text-muted font-medium">{timestamp}</span>
          {msg.edited_at && !msg.deleted && (
            <span className="text-[9px] text-text-muted select-none font-medium">(edited)</span>
          )}
        </div>

        {/* Dynamic Body: Edit Form vs Rendered Content */}
        {isEditing ? (
          <MessageEditForm
            initialContent={msg.content}
            onSubmit={handleEditSubmit}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <MessageContent msg={msg} />
        )}

        {/* Reactions List */}
        {!msg.deleted && (
          <MessageReactions
            messageId={msg.id}
            reactions={msg.reactions || []}
            onAddReaction={onAddReaction}
            onRemoveReaction={onRemoveReaction}
            canAddReactions={canAddReactions}
          />
        )}
      </div>

      {/* Hover Action Toolbar */}
      {!msg.deleted && !isEditing && (
        <MessageActions
          messageId={msg.id}
          isAuthor={isAuthor}
          canManageMessages={canManageMessages}
          canAddReactions={canAddReactions}
          onReply={onReply}
          onEdit={() => setIsEditing(true)}
          onDelete={onDelete}
          onAddReaction={onAddReaction}
        />
      )}
    </div>
  );
});
