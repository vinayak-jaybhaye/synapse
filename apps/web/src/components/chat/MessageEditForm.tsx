"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

interface MessageEditFormProps {
  initialContent: string;
  onSubmit: (content: string) => Promise<void>;
  onCancel: () => void;
}

export default function MessageEditForm({
  initialContent,
  onSubmit,
  onCancel,
}: MessageEditFormProps) {
  const [editContent, setEditContent] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 250)}px`;
  }, []);

  // Auto-resize on mount and when content changes
  useEffect(() => {
    adjustHeight();
  }, [editContent, adjustHeight]);

  // Focus + select all on mount
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, []);

  const handleEditSubmit = async () => {
    if (!editContent.trim()) return;
    await onSubmit(editContent.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEditSubmit();
    }
    if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="mt-1.5 flex flex-col gap-1.5 w-full">
      <textarea
        ref={textareaRef}
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Edit message"
        rows={1}
        className="bg-bg-tertiary border border-border-custom rounded-xl px-3.5 py-2.5 text-text-primary text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-500 focus-visible:outline-none w-full resize-none scrollbar-thin overflow-y-auto"
      />
      <div className="text-[10px] text-text-muted select-none">
        escape to{" "}
        <button onClick={onCancel} className="text-indigo-400 hover:underline cursor-pointer">
          cancel
        </button>{" "}
        • enter to{" "}
        <button
          onClick={handleEditSubmit}
          className="text-indigo-400 hover:underline cursor-pointer"
        >
          save
        </button>
      </div>
    </div>
  );
}
