"use client";

import React, { useEffect, useRef } from "react";
import {
  useInbox,
  useMarkRead,
  useMarkAllRead,
  useDeleteNotification,
} from "../../services/query/useNotifications";
import {
  Bell,
  Check,
  Trash2,
  Loader2,
  MessageSquare,
  UserPlus,
  Heart,
  Users,
  AtSign,
} from "lucide-react";
import { NotificationModel } from "../../services/api/notifications";

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return Math.floor(seconds) + "s ago";
}

interface InboxPopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

const getNotificationIcon = (type: number) => {
  switch (type) {
    case 1: // Mention
      return <AtSign className="h-4 w-4 text-indigo-500" />;
    case 2: // Reply
      return <MessageSquare className="h-4 w-4 text-blue-500" />;
    case 3: // Reaction
      return <Heart className="h-4 w-4 text-red-500" />;
    case 4: // Friend Request
      return <UserPlus className="h-4 w-4 text-green-500" />;
    case 5: // Friend Accepted
      return <Users className="h-4 w-4 text-emerald-500" />;
    default:
      return <Bell className="h-4 w-4 text-text-muted" />;
  }
};

const getNotificationText = (notif: NotificationModel) => {
  if (notif.metadata?.content) return notif.metadata.content;

  switch (notif.type) {
    case 1:
      return "You were mentioned in a message";
    case 2:
      return "Someone replied to your message";
    case 3:
      return "Someone reacted to your message";
    case 4:
      return "You received a friend request";
    case 5:
      return "Your friend request was accepted";
    case 6:
      return "You received a server invite";
    case 7:
      return "You received a channel invite";
    case 8:
      return "You missed a call";
    default:
      return "New notification";
  }
};

export default function InboxPopover({ open, onClose, anchorRef }: InboxPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  const { data: inbox, isLoading } = useInbox();
  const { mutate: markRead } = useMarkRead();
  const { mutate: markAllRead } = useMarkAllRead();
  const { mutate: deleteNotif } = useDeleteNotification();

  // Click outside and ESC key listener
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const handleClickOutside = (e: MouseEvent) => {
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
      className="absolute right-4 top-14 w-96 max-h-[500px] z-50 shadow-2xl animate-fadeIn bg-bg-secondary/95 backdrop-blur-md rounded-xl border border-border-custom overflow-hidden flex flex-col"
      role="dialog"
      aria-label="Notification Inbox"
    >
      <div className="flex items-center justify-between p-4 border-b border-border-custom shrink-0">
        <h3 className="font-bold text-text-primary text-lg">Inbox</h3>
        <div className="flex gap-2">
          <button
            onClick={() => markAllRead()}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded-md transition-colors"
            title="Mark all as read"
          >
            <Check className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-[100px] max-h-[400px]">
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
          </div>
        ) : !inbox || inbox.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-text-muted">
            <Bell className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm font-medium">You're all caught up!</p>
            <p className="text-xs mt-1">No new notifications</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {inbox.map((notif: NotificationModel) => (
              <div
                key={notif.id}
                className={`flex gap-3 p-3 border-b border-border-custom/50 hover:bg-bg-tertiary transition-colors cursor-pointer group ${
                  !notif.is_read ? "bg-indigo-500/10" : ""
                }`}
                onClick={() => {
                  if (!notif.is_read) markRead(notif.id);
                  // Optionally navigate based on notif.reference_type and notif.reference_id
                  // onClose();
                }}
              >
                <div className="shrink-0 mt-1">{getNotificationIcon(notif.type)}</div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-sm ${!notif.is_read ? "font-semibold text-text-primary" : "text-text-secondary"}`}
                    >
                      {getNotificationText(notif)}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotif(notif.id);
                      }}
                      className="shrink-0 p-1 rounded-md text-text-muted opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-bg-secondary transition-all"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="text-xs text-text-muted mt-1 block">
                    {timeAgo(notif.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
