"use client";

import React from "react";
import { Message } from "../../types";

interface MessageContentProps {
  msg: Message;
}

export default function MessageContent({ msg }: MessageContentProps) {
  if (msg.deleted) {
    return (
      <p className="text-text-muted text-xs italic mt-1.5 select-none">
        This message has been deleted.
      </p>
    );
  }

  // Future: Switch on msg.message_type for embeds, attachments, link previews, system messages
  return (
    <p className="text-text-secondary text-sm mt-1 select-text whitespace-pre-wrap leading-relaxed break-words">
      {msg.content}
    </p>
  );
}
