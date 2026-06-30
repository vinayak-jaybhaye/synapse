"use client";

import React from "react";
import { Message } from "../../types";
import { useMessageRegistry } from "../../store/message-registry";

interface MessageReplyPreviewProps {
  replyPreview: NonNullable<Message["reply_preview"]>;
}

// Abstraction for future media support
const renderPreviewContent = (preview: NonNullable<Message["reply_preview"]>) => {
  if (preview.deleted) {
    return <span className="italic text-text-muted/80">Original message was deleted.</span>;
  }

  // Future: Check if it's an image, video, etc.
  // if (preview.type === 'IMAGE') return <span>📸 Image</span>;

  return preview.content;
};

export default function MessageReplyPreview({ replyPreview }: MessageReplyPreviewProps) {
  const { scrollToMessage } = useMessageRegistry();

  const handleJump = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    scrollToMessage(replyPreview.id);
  };

  return (
    <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1 relative ml-1 select-none">
      {/* Discord-style curved connector line */}
      <div className="absolute -left-[32px] top-1/2 w-[24px] h-[16px] border-l-2 border-t-2 border-border-custom/80 rounded-tl-lg pointer-events-none -translate-y-full" />

      {/* Tiny Avatar initial */}
      <div className="shrink-0 h-4 w-4 rounded-full bg-bg-tertiary flex items-center justify-center font-semibold text-[8px] text-text-primary/70">
        {replyPreview.username ? replyPreview.username.substring(0, 1).toUpperCase() : "M"}
      </div>

      {/* Interactive jump button */}
      <button
        type="button"
        onClick={handleJump}
        className="flex items-center gap-1 min-w-0 max-w-full text-left group hover:opacity-100 transition-opacity outline-none rounded-sm focus-visible:ring-1 focus-visible:ring-indigo-500"
        aria-label={`Jump to reply by ${replyPreview.username || "user"}: ${replyPreview.content || "deleted message"}`}
      >
        <span className="font-semibold text-text-primary/80 group-hover:underline truncate shrink-0">
          {replyPreview.username || `User ${replyPreview.author_id.substring(0, 5)}`}
        </span>
        <span className="truncate opacity-70 group-hover:text-text-primary group-hover:opacity-100 transition-colors">
          {renderPreviewContent(replyPreview)}
        </span>
      </button>
    </div>
  );
}
