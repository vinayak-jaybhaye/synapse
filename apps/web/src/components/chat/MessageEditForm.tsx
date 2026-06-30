"use client";

import React, { useState } from "react";

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

  const handleEditSubmit = async () => {
    if (!editContent.trim()) return;
    await onSubmit(editContent.trim());
  };

  return (
    <div className="mt-1.5 flex flex-col gap-1.5 w-full">
      <input
        type="text"
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleEditSubmit();
          if (e.key === "Escape") onCancel();
        }}
        aria-label="Edit message"
        className="bg-bg-tertiary border border-border-custom rounded-lg px-3 py-1.5 text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
        autoFocus
      />
      <div className="text-[10px] text-text-muted select-none">
        escape to{" "}
        <button onClick={onCancel} className="text-indigo-400 hover:underline">
          cancel
        </button>{" "}
        • enter to{" "}
        <button onClick={handleEditSubmit} className="text-indigo-400 hover:underline">
          save
        </button>
      </div>
    </div>
  );
}
