/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { useMembers } from "../../services/query/useMembers";
import { getMediaUrl } from "../../lib/media";
import { Member } from "../../types";

interface MentionPickerPopoverProps {
  open: boolean;
  query: string;
  guildId?: string;
  onSelect: (member: Member) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLTextAreaElement | null>;
}

export default function MentionPickerPopover({
  open,
  query,
  guildId,
  onSelect,
  onClose,
  anchorRef,
}: MentionPickerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { members } = useMembers(guildId);

  const filtered = useMemo(() => {
    if (!members || members.length === 0) return [];
    const q = query.toLowerCase();
    return members
      .filter((m: Member) => {
        const username = m.username?.toLowerCase() || "";
        const displayName = (m.display_name || "").toLowerCase();
        const nickname = (m.nickname || "").toLowerCase();
        return username.includes(q) || displayName.includes(q) || nickname.includes(q);
      })
      .slice(0, 10);
  }, [members, query]);

  // Reset active index when filtered list changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIndex(0);
  }, [filtered.length, query]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((prev) => (prev + 1) % Math.max(filtered.length, 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((prev) => (prev <= 0 ? Math.max(filtered.length - 1, 0) : prev - 1));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        if (filtered[activeIndex]) {
          onSelect(filtered[activeIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    // Use capture phase so we intercept before the textarea's own handler
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, filtered, activeIndex, onSelect, onClose]);

  // Click outside
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose, anchorRef]);

  // Scroll the active item into view
  useEffect(() => {
    if (!open) return;
    const activeEl = popoverRef.current?.querySelector(`[data-mention-index="${activeIndex}"]`);
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  if (!open || filtered.length === 0) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-full left-0 right-0 mb-1 z-50 max-h-[240px] overflow-y-auto bg-bg-secondary/95 backdrop-blur-md rounded-lg border border-border-custom shadow-2xl animate-fadeIn"
      role="listbox"
      aria-label="Mention suggestions"
    >
      <div className="p-1">
        <div className="px-2 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wide">
          Members
        </div>
        {filtered.map((member: Member, index: number) => {
          const displayName = member.nickname || member.display_name || member.username;
          return (
            <button
              key={member.user_id}
              data-mention-index={index}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors cursor-pointer ${
                index === activeIndex
                  ? "bg-indigo-600/20 text-text-primary"
                  : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
              }`}
              onClick={() => onSelect(member)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              {member.avatar_key ? (
                <img
                  src={getMediaUrl(member.avatar_key)}
                  alt={displayName}
                  className="w-6 h-6 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {(member.username || "?")[0].toUpperCase()}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate">{displayName}</span>
                {displayName !== member.username && (
                  <span className="text-xs text-text-muted truncate">{member.username}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
