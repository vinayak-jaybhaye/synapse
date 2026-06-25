"use client";

import React, { useState, useRef } from "react";
import { Reply, Smile, Edit2, Trash2 } from "lucide-react";
import EmojiPickerPopover from "./EmojiPickerPopover";

interface MessageActionsProps {
  messageId: string;
  isAuthor: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: (messageId: string) => Promise<void>;
  onAddReaction: (messageId: string, emoji: string) => Promise<void>;
}

export default function MessageActions({
  messageId,
  isAuthor,
  onReply,
  onEdit,
  onDelete,
  onAddReaction,
}: MessageActionsProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  const handleEmojiSelect = (emoji: { native: string }) => {
    onAddReaction(messageId, emoji.native);
    setShowEmojiPicker(false);
  };

  return (
    <>
      <div
        className="absolute right-4 -top-2 opacity-0 group-hover:opacity-100 flex items-center bg-bg-secondary border border-border-custom rounded-lg shadow-md transition-opacity duration-75 overflow-hidden z-10"
        role="toolbar"
        aria-label="Message Actions"
      >
        <button
          onClick={onReply}
          className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer"
          title="Reply"
          aria-label="Reply"
        >
          <Reply className="h-4 w-4" />
        </button>

        <button
          ref={emojiButtonRef}
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          className={`p-2 transition-colors cursor-pointer ${
            showEmojiPicker ? "text-indigo-400 bg-bg-tertiary" : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
          }`}
          title="Add Reaction"
          aria-label="Add Reaction"
        >
          <Smile className="h-4 w-4" />
        </button>

        {isAuthor && (
          <>
            <button
              onClick={onEdit}
              className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer"
              title="Edit Message"
              aria-label="Edit Message"
            >
              <Edit2 className="h-4 w-4" />
            </button>

            <button
              onClick={() => {
                if (confirm("Are you sure you want to delete this message?")) {
                  onDelete(messageId);
                }
              }}
              className="p-2 text-red-400 hover:text-red-500 hover:bg-bg-tertiary transition-colors cursor-pointer"
              title="Delete Message"
              aria-label="Delete Message"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {showEmojiPicker && (
        <EmojiPickerPopover
          open={showEmojiPicker}
          onClose={() => setShowEmojiPicker(false)}
          onEmojiSelect={handleEmojiSelect}
          anchorRef={emojiButtonRef}
        />
      )}
    </>
  );
}
