"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamically import the heavy Picker component to keep initial bundle size small
const Picker = dynamic(() => import("@emoji-mart/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[350px] w-[350px] bg-bg-secondary rounded-xl">
      <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
    </div>
  ),
});

interface EmojiPickerPopoverProps {
  open: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: { native: string }) => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export default function EmojiPickerPopover({
  open,
  onClose,
  onEmojiSelect,
  anchorRef,
}: EmojiPickerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ bottom: "100%", right: "0px" });

  useEffect(() => {
    if (open && anchorRef.current) {
      // Basic positioning: Above the trigger and right-aligned
      // In a very robust implementation, we would use floating-ui to prevent clipping
      const rect = anchorRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;

      // Check if it would overflow right
      const isMobile = viewportWidth < 640;
      
      setPosition({
        bottom: `calc(100% + 12px)`, // 12px gap above button
        right: isMobile ? `-${rect.right - viewportWidth + 16}px` : "0px",
      });
    }
  }, [open, anchorRef]);

  // Click outside and ESC key listener
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      // Don't close if clicking the anchor button itself (it has its own toggle logic)
      if (anchorRef.current && anchorRef.current.contains(e.target as Node)) {
        return;
      }
      
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 shadow-2xl animate-fadeIn"
      style={{
        bottom: position.bottom,
        right: position.right,
      }}
      role="dialog"
      aria-label="Emoji Picker"
    >
      <Picker
        onEmojiSelect={onEmojiSelect}
        theme="auto" // We use CSS variables to theme it automatically
        set="native"
        previewPosition="none"
        skinTonePosition="none"
        navPosition="bottom"
      />
    </div>
  );
}
