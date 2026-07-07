import React, { useEffect, useState } from "react";
import { useTypingStore } from "../../store/typing-store";
import { useMembers } from "../../services/query/useMembers";
import { useGuildStore } from "../../store/guild-store";
import { useAuthStore } from "../../store/auth-store";

interface TypingIndicatorProps {
  channelId: string | number;
  /** For DM contexts, pass the recipient's display name so we don't need guild member lookups. */
  dmRecipientName?: string;
}

const EMPTY_TYPING = {};

export default function TypingIndicator({ channelId, dmRecipientName }: TypingIndicatorProps) {
  const { activeGuildId } = useGuildStore();
  const { infiniteMembers } = useMembers(activeGuildId || undefined);
  const typing = useTypingStore((s) => s.typing[String(channelId)] || EMPTY_TYPING);
  const cleanupTyping = useTypingStore((s) => s.cleanupTyping);
  const localUserId = useAuthStore((s) => s.user?.id);
  const [activeUsers, setActiveUsers] = useState<string[]>([]);

  // Periodically clean up old typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      cleanupTyping(channelId, 3000);
    }, 1000);
    return () => clearInterval(interval);
  }, [channelId, cleanupTyping]);

  useEffect(() => {
    const now = Date.now();
    const active = Object.entries(typing)
      .filter(([userId, timestamp]) => userId !== String(localUserId) && now - timestamp < 3000)
      .map(([userId]) => userId);
    setActiveUsers(active);
  }, [typing, localUserId]);

  if (activeUsers.length === 0) return null;

  const resolveName = (userId: string): string => {
    // In a DM, the only other person typing is the recipient
    if (dmRecipientName) return dmRecipientName;
    const member = infiniteMembers.find((m) => String(m.user_id) === userId);
    return member?.nickname || member?.display_name || member?.username || "Someone";
  };

  let text = "";
  if (activeUsers.length === 1) {
    text = `${resolveName(activeUsers[0])} is typing...`;
  } else if (activeUsers.length <= 3) {
    const names = activeUsers.map(resolveName);
    text = `${names.join(", ")} are typing...`;
  } else {
    text = "Several people are typing...";
  }

  return (
    <div className="absolute -top-6 left-0 px-4 h-6 flex items-center gap-1.5 pointer-events-none">
      <div className="flex gap-0.5 mt-1">
        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
      </div>
      <span className="text-xs font-medium text-text-muted">{text}</span>
    </div>
  );
}
