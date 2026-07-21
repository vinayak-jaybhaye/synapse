/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState } from "react";
import { Message, Attachment } from "../../types";
import { File, Download, Maximize2 } from "lucide-react";
import MediaViewerModal from "./MediaViewerModal";
import CustomVideoPlayer from "./CustomVideoPlayer";
import { api } from "../../lib/api";
import { useMembers } from "../../services/query/useMembers";
import { useGuildStore } from "../../store/guild-store";

interface MessageContentProps {
  msg: Message;
}

// Parses message content and replaces <@user_id> with styled mention pills
function renderContentWithMentions(
  content: string,
  memberMap: Map<string, { display_name?: string; nickname?: string; username: string }>,
) {
  const parts: React.ReactNode[] = [];
  const mentionRegex = /<@(\d+)>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    const userId = match[1];
    const member = memberMap.get(userId);
    const displayName = member
      ? member.nickname || member.display_name || member.username
      : `Unknown User`;

    parts.push(
      <span
        key={`mention-${match.index}`}
        className="inline-flex items-center px-1 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-medium text-[13px] cursor-pointer hover:bg-indigo-500/30 transition-colors"
        title={member ? `@${member.username}` : `User ID: ${userId}`}
      >
        @{displayName}
      </span>,
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last mention
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [content];
}

export default function MessageContent({ msg }: MessageContentProps) {
  const { activeGuildId } = useGuildStore();
  const { members } = useMembers(activeGuildId || undefined);

  // Build a lookup map from user_id -> member info
  const memberMap = React.useMemo(() => {
    const map = new Map<string, { display_name?: string; nickname?: string; username: string }>();
    if (members) {
      for (const m of members) {
        map.set(m.user_id, {
          display_name: m.display_name,
          nickname: m.nickname,
          username: m.username,
        });
      }
    }
    return map;
  }, [members]);

  if (msg.deleted) {
    return (
      <p className="text-text-muted text-xs italic mt-1.5 select-none">
        This message has been deleted.
      </p>
    );
  }

  const hasMentions = msg.content && /<@\d+>/.test(msg.content);

  return (
    <div className="flex flex-col gap-2 mt-1">
      {msg.content && (
        <p className="text-text-secondary text-sm select-text whitespace-pre-wrap leading-relaxed break-words">
          {hasMentions ? renderContentWithMentions(msg.content, memberMap) : msg.content}
        </p>
      )}

      {msg.attachments && msg.attachments.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-1">
          {msg.attachments.map((attachment) => (
            <AttachmentRenderer
              key={attachment.id}
              attachment={attachment}
              channelId={msg.channel_id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AttachmentRenderer({
  attachment,
  channelId,
}: {
  attachment: Attachment;
  channelId: string;
}) {
  const isImage = attachment.mime_type.startsWith("image/");
  const isVideo = attachment.mime_type.startsWith("video/");

  return (
    <div className="max-w-[400px]">
      {isImage || isVideo ? (
        <MediaAttachment attachment={attachment} isVideo={isVideo} channelId={channelId} />
      ) : (
        <FileAttachment attachment={attachment} channelId={channelId} />
      )}
    </div>
  );
}

function MediaAttachment({
  attachment,
  isVideo,
  channelId,
}: {
  attachment: Attachment;
  isVideo: boolean;
  channelId: string;
}) {
  const token = localStorage.getItem("synapse_token");
  const url = `${api.defaults.baseURL}/channels/${channelId}/attachments/${attachment.id}?token=${token}`;
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  if (isVideo) {
    return (
      <>
        <div className="group relative rounded-lg overflow-hidden border border-border-custom bg-black max-h-[350px] inline-block">
          <CustomVideoPlayer src={url} maxHeightClass="max-h-[350px]" />
          <button
            onClick={() => setIsViewerOpen(true)}
            className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-20"
            title="Expand Video"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        <MediaViewerModal
          url={url}
          fileName={attachment.file_name}
          isOpen={isViewerOpen}
          isVideo={true}
          onClose={() => setIsViewerOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsViewerOpen(true)}
        className="block relative rounded-lg overflow-hidden border border-border-custom bg-bg-tertiary max-h-[350px] cursor-zoom-in transition-opacity hover:opacity-90 focus:outline-none"
      >
        <img
          src={url}
          alt={attachment.file_name}
          className="max-h-[350px] w-auto max-w-full object-contain"
        />
      </button>

      <MediaViewerModal
        url={url}
        fileName={attachment.file_name}
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
      />
    </>
  );
}

function FileAttachment({ attachment, channelId }: { attachment: Attachment; channelId: string }) {
  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleDownload = () => {
    const token = localStorage.getItem("synapse_token");
    const downloadUrl = `${api.defaults.baseURL}/channels/${channelId}/attachments/${attachment.id}?token=${token}`;
    window.open(downloadUrl, "_blank");
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-bg-tertiary border border-border-custom rounded-lg max-w-[300px]">
      <div className="p-2 bg-indigo-500/10 rounded-md">
        <File className="w-6 h-6 text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="text-sm font-medium text-text-primary truncate"
          title={attachment.file_name}
        >
          {attachment.file_name}
        </div>
        <div className="text-xs text-text-muted">{formatSize(attachment.file_size)}</div>
      </div>
      <button
        onClick={handleDownload}
        className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-secondary rounded cursor-pointer transition-colors"
        title="Download file"
      >
        <Download className="w-4 h-4" />
      </button>
    </div>
  );
}
