"use client";

import React from "react";
import { ReactionSummary } from "../../types";

interface MessageReactionsProps {
  messageId: string;
  reactions: ReactionSummary[];
  onAddReaction: (messageId: string, emoji: string) => Promise<void>;
  onRemoveReaction: (messageId: string, emoji: string) => Promise<void>;
}

export default function MessageReactions({
  messageId,
  reactions,
  onAddReaction,
  onRemoveReaction,
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
          onClick={() => handleReactionClick(rs)}
          className="inline-flex items-center gap-1.5 bg-bg-secondary border border-border-custom hover:border-indigo-500/50 hover:bg-bg-primary px-2 py-0.5 rounded-md text-xs font-semibold cursor-pointer select-none transition-colors"
          aria-label={`Toggle reaction ${rs.emoji}`}
        >
          <span>{rs.emoji}</span>
          <span className="text-[10px] text-text-secondary">{rs.count}</span>
        </button>
      ))}
    </div>
  );
}
