"use client";

import React from "react";
import { ReactionSummary } from "../../types";
import { useChannelPermissions } from "../../hooks/usePermissions";

interface MessageReactionsProps {
  messageId: string;
  reactions: ReactionSummary[];
  onAddReaction: (messageId: string, emoji: string) => Promise<void>;
  onRemoveReaction: (messageId: string, emoji: string) => Promise<void>;
  canAddReactions?: boolean;
}

export default function MessageReactions({
  messageId,
  reactions,
  onAddReaction,
  onRemoveReaction,
  canAddReactions = true,
}: MessageReactionsProps) {
  if (!reactions || reactions.length === 0) return null;

  const handleReactionClick = async (rs: ReactionSummary) => {
    // Basic toggle mechanism 
    try {
      await onAddReaction(messageId, rs.emoji);
    } catch (err) {
      // Toggle back if error
      await onRemoveReaction(messageId, rs.emoji);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="Reactions">
      {reactions.map((rs, idx) => (
        <button
          key={idx}
          onClick={() => {
            if (canAddReactions) handleReactionClick(rs);
          }}
          disabled={!canAddReactions}
          className={`inline-flex items-center gap-1.5 border px-2 py-0.5 rounded-md text-xs font-semibold select-none transition-colors ${
            canAddReactions
              ? "bg-bg-secondary border-border-custom hover:border-indigo-500/50 hover:bg-bg-primary cursor-pointer"
              : "bg-bg-secondary border-border-custom opacity-70 cursor-not-allowed"
          }`}
          title={canAddReactions ? undefined : "You do not have permission to react."}
          aria-label={`Toggle reaction ${rs.emoji}`}
        >
          <span>{rs.emoji}</span>
          <span className="text-[10px] text-text-secondary">{rs.count}</span>
        </button>
      ))}
    </div>
  );
}
