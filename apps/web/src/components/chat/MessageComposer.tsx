"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useUIStore } from "../../store/ui-store";
import { Paperclip, Smile, Send } from "lucide-react";
import EmojiPickerPopover from "./EmojiPickerPopover";
import MentionPickerPopover from "./MentionPickerPopover";
import UploadAttachmentItem from "./UploadAttachmentItem";
import { PendingUploadState, Member } from "../../types";
import { useChannelPermissions } from "../../hooks/usePermissions";
import { mediaApi } from "../../services/api/media";
import { normalizeError } from "../../lib/api";
import { gateway } from "../../features/realtime/gateway";

interface MessageComposerProps {
  channelId: string;
  placeholder: string;
  onSend: (content: string, uploadIds?: string[]) => Promise<void>;
  draftKey?: string;
  permissions?: string;
  isDM?: boolean;
  guildId?: string;
}

export default function MessageComposer({
  channelId,
  placeholder,
  onSend,
  draftKey,
  permissions,
  isDM,
  guildId,
}: MessageComposerProps) {
  const { drafts, setDraft } = useUIStore();
  const [inputText, setInputText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingUploadState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const mentionTriggerIndexRef = useRef<number>(-1);
  // Maps display name → user_id for mentions inserted via the picker
  const mentionsMapRef = useRef<Map<string, string>>(new Map());

  const {
    canSendMessages,
    canAttachFiles,
    canEmbedLinks,
    canMentionEveryone,
    canUseExternalEmojis,
    canUseExternalStickers,
  } = useChannelPermissions(permissions, isDM);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep a ref of pendingUploads for cleanup on unmount
  const pendingUploadsRef = useRef<PendingUploadState[]>([]);
  useEffect(() => {
    pendingUploadsRef.current = pendingUploads;
  }, [pendingUploads]);

  // Sync draft text on channel change
  useEffect(() => {
    if (draftKey) {
      setInputText(drafts[draftKey] || "");
    } else {
      setInputText("");
    }
    // Auto focus the input field on channel load
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        adjustTextareaHeight();
      }
    }, 50);
  }, [draftKey]);

  // Cleanup abandoned uploads on unmount
  useEffect(() => {
    return () => {
      pendingUploadsRef.current.forEach((upload) => {
        if (upload.uploadId && upload.state !== "UPLOADED") {
          mediaApi.cancelUpload(upload.uploadId).catch(console.error);
        }
        if (upload.previewUrl) {
          URL.revokeObjectURL(upload.previewUrl);
        }
      });
    };
  }, []);

  const syncHighlightScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(textareaRef.current.scrollHeight, 250);
      textareaRef.current.style.height = `${newHeight}px`;
      // Sync highlight overlay height
      if (highlightRef.current) {
        highlightRef.current.style.height = `${newHeight}px`;
      }
    }
  };

  const lastTypingRef = useRef<number>(0);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);
    if (draftKey) {
      setDraft(draftKey, val);
    }
    adjustTextareaHeight();

    const now = Date.now();
    if (val.length > 0 && now - lastTypingRef.current > 2000) {
      lastTypingRef.current = now;
      gateway.sendTypingStart(channelId);
    }

    // Mention detection: look for @ trigger
    if (guildId && !isDM) {
      const cursorPos = e.target.selectionStart;
      const textUpToCursor = val.slice(0, cursorPos);
      // Find the last @ that isn't inside an existing <@id> tag
      const lastAtIndex = textUpToCursor.lastIndexOf("@");
      if (lastAtIndex >= 0) {
        // Make sure this @ is either at position 0 or preceded by a space/newline
        const charBefore = lastAtIndex > 0 ? textUpToCursor[lastAtIndex - 1] : " ";
        if (charBefore === " " || charBefore === "\n" || lastAtIndex === 0) {
          const query = textUpToCursor.slice(lastAtIndex + 1);
          // Only open if query doesn't contain spaces (still typing the name)
          if (!query.includes(" ") && query.length <= 32) {
            setMentionOpen(true);
            setMentionQuery(query);
            mentionTriggerIndexRef.current = lastAtIndex;
            return;
          }
        }
      }
      setMentionOpen(false);
      setMentionQuery("");
    }
  };

  const handleMentionSelect = useCallback(
    (member: Member) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const triggerIndex = mentionTriggerIndexRef.current;
      const cursorPos = textarea.selectionStart;
      const before = inputText.slice(0, triggerIndex);
      const after = inputText.slice(cursorPos);
      const displayName = member.nickname || member.display_name || member.username;
      const mentionDisplay = `@${displayName} `;
      const newText = before + mentionDisplay + after;

      // Track the mapping so we can transform back to <@id> on send
      mentionsMapRef.current.set(displayName, member.user_id);

      setInputText(newText);
      if (draftKey) {
        setDraft(draftKey, newText);
      }
      setMentionOpen(false);
      setMentionQuery("");

      setTimeout(() => {
        textarea.focus();
        const newCursorPos = before.length + mentionDisplay.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        adjustTextareaHeight();
      }, 0);
    },
    [inputText, draftKey, setDraft],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't handle Enter/Tab/Arrow when mention picker is open — it handles them via capture
    if (mentionOpen && ["ArrowUp", "ArrowDown", "Enter", "Tab", "Escape"].includes(e.key)) {
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const isUploading = pendingUploads.some((u) => u.state === "QUEUED" || u.state === "UPLOADING");
  const canSend = (inputText.trim().length > 0 || pendingUploads.length > 0) && !isUploading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSendMessages || !canSend) return;

    const rawInputText = inputText;
    // Transform @displayName back to <@user_id> before sending
    let textToSend = rawInputText.trim();
    mentionsMapRef.current.forEach((userId, displayName) => {
      // Replace all occurrences of @displayName with <@userId>
      const pattern = `@${displayName}`;
      while (textToSend.includes(pattern)) {
        textToSend = textToSend.replace(pattern, `<@${userId}>`);
      }
    });

    const uploadIds = pendingUploads
      .filter((u) => u.state === "UPLOADED" && u.uploadId)
      .map((u) => u.uploadId!);

    setInputText("");
    if (draftKey) {
      setDraft(draftKey, "");
    }

    // Clear uploads from UI so they don't get canceled on unmount
    const completedUploads = pendingUploads;
    setPendingUploads([]);
    pendingUploadsRef.current = [];

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      await onSend(textToSend, uploadIds);
      mentionsMapRef.current.clear();
      // Clean up object URLs
      completedUploads.forEach((u) => {
        if (u.previewUrl) URL.revokeObjectURL(u.previewUrl);
      });
    } catch (err) {
      // Revert UI state on failure, preserving original @displayName text and mention map
      setInputText(rawInputText);
      if (draftKey) {
        setDraft(draftKey, rawInputText);
      }
      setPendingUploads(completedUploads);
      setTimeout(adjustTextareaHeight, 0);
    }
  };

  const handleEmojiSelect = (emoji: { native: string }) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = inputText;

    const newText = currentText.substring(0, start) + emoji.native + currentText.substring(end);

    setInputText(newText);
    if (draftKey) {
      setDraft(draftKey, newText);
    }

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.native.length, start + emoji.native.length);
      adjustTextareaHeight();
    }, 0);
  };

  // ─── Drag & Drop & Upload Logic ──────────────────────────────────────────

  const processFiles = useCallback((files: FileList | File[]) => {
    const newUploads: PendingUploadState[] = Array.from(files).map((file) => {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      return {
        id: crypto.randomUUID(),
        file,
        state: "QUEUED",
        progress: 0,
        previewUrl: isImage || isVideo ? URL.createObjectURL(file) : undefined,
      };
    });

    setPendingUploads((prev) => [...prev, ...newUploads]);
    newUploads.forEach(startUpload);
  }, []);

  const startUpload = async (uploadState: PendingUploadState) => {
    const MB = 1024 * 1024;
    const MAX_SIZE = 25 * MB;

    // Client-side size validation — not an unexpected error, so handle before try/catch
    if (uploadState.file.size > MAX_SIZE) {
      const errorMessage = `File is too large (max 25MB)`;
      setPendingUploads((prev) =>
        prev.map((u) => (u.id === uploadState.id ? { ...u, state: "FAILED", errorMessage } : u)),
      );
      useUIStore.getState().showToast(errorMessage, "error");
      return;
    }

    try {
      // 1. Generate Upload URL
      const extMatch = uploadState.file.name.match(/(\.[^.]+)$/);
      const extension = extMatch ? extMatch[1] : "";

      setPendingUploads((prev) =>
        prev.map((u) => (u.id === uploadState.id ? { ...u, state: "UPLOADING" } : u)),
      );

      const { upload_url, upload_id } = await mediaApi.generateAttachmentUploadUrl(channelId, {
        category: "attachment",
        extension,
        file_name: uploadState.file.name,
        size: uploadState.file.size,
        content_type: uploadState.file.type || "application/octet-stream",
      });

      setPendingUploads((prev) =>
        prev.map((u) => (u.id === uploadState.id ? { ...u, uploadId: upload_id } : u)),
      );

      // 2. Put file to S3
      await mediaApi.uploadFileToS3(upload_url, uploadState.file, (progressEvent) => {
        if (progressEvent.total) {
          const progress = (progressEvent.loaded * 100) / progressEvent.total;
          setPendingUploads((prev) =>
            prev.map((u) => (u.id === uploadState.id ? { ...u, progress } : u)),
          );
        }
      });

      // 3. Mark Complete
      await mediaApi.markUploadComplete(upload_id);

      setPendingUploads((prev) =>
        prev.map((u) => (u.id === uploadState.id ? { ...u, state: "UPLOADED", progress: 100 } : u)),
      );
    } catch (error: unknown) {
      const errorMessage = normalizeError(error).message;
      setPendingUploads((prev) =>
        prev.map((u) => (u.id === uploadState.id ? { ...u, state: "FAILED", errorMessage } : u)),
      );
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    // Reset input so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeUpload = async (id: string) => {
    const upload = pendingUploads.find((u) => u.id === id);
    if (!upload) return;

    setPendingUploads((prev) => prev.filter((u) => u.id !== id));

    if (upload.previewUrl) {
      URL.revokeObjectURL(upload.previewUrl);
    }

    if (upload.uploadId) {
      try {
        await mediaApi.cancelUpload(upload.uploadId);
      } catch (e) {
        console.error("Failed to cancel upload on backend", e);
      }
    }
  };

  const retryUpload = (id: string) => {
    const upload = pendingUploads.find((u) => u.id === id);
    if (!upload) return;
    startUpload(upload);
  };

  // Drag overlay handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  return (
    <div
      className={`relative bg-bg-secondary border rounded-xl transition-colors ${
        isDragging
          ? "border-indigo-500 bg-indigo-500/10"
          : "border-border-custom/80 focus-within:border-indigo-500/70"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Attachments Preview Area */}
      {pendingUploads.length > 0 && (
        <div className="flex flex-wrap gap-3 p-4 pb-0">
          {pendingUploads.map((upload) => (
            <UploadAttachmentItem
              key={upload.id}
              upload={upload}
              onRemove={removeUpload}
              onRetry={retryUpload}
            />
          ))}
        </div>
      )}

      {/* Input Bar */}
      <form onSubmit={handleSubmit} className="px-4 py-2.5 flex items-end gap-3 relative">
        <input
          type="file"
          multiple
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileSelect}
        />

        <div className="relative flex items-center mb-0.5">
          <button
            ref={emojiButtonRef}
            type="button"
            className={`p-1.5 rounded cursor-pointer transition-colors ${
              showEmojiPicker
                ? "text-indigo-400 bg-bg-tertiary"
                : "text-text-secondary hover:text-text-primary"
            }`}
            title="Emoji Picker"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
          >
            <Smile className="h-4.5 w-4.5" />
          </button>

          <EmojiPickerPopover
            open={showEmojiPicker}
            onClose={() => {
              setShowEmojiPicker(false);
              textareaRef.current?.focus();
            }}
            onEmojiSelect={handleEmojiSelect}
            anchorRef={emojiButtonRef}
          />
        </div>

        <div className="flex-1 relative">
          <MentionPickerPopover
            open={mentionOpen}
            query={mentionQuery}
            guildId={guildId}
            onSelect={handleMentionSelect}
            onClose={() => {
              setMentionOpen(false);
              setMentionQuery("");
            }}
            anchorRef={textareaRef}
          />
          {/* Highlight overlay — mirrors textarea content with styled mentions */}
          {mentionsMapRef.current.size > 0 && (
            <div
              ref={highlightRef}
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none text-sm py-1.5 min-h-[36px] whitespace-pre-wrap break-words leading-relaxed overflow-hidden no-scrollbar text-transparent"
            >
              {(() => {
                if (mentionsMapRef.current.size === 0) return inputText;
                const mentionNames = Array.from(mentionsMapRef.current.keys());
                // Build a regex that matches any @displayName
                const escaped = mentionNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
                const regex = new RegExp(`(@(?:${escaped.join("|")}))(\\s|$)`, "g");
                const parts: React.ReactNode[] = [];
                let lastIdx = 0;
                let match: RegExpExecArray | null;
                const text = inputText;
                while ((match = regex.exec(text)) !== null) {
                  if (match.index > lastIdx) {
                    parts.push(text.slice(lastIdx, match.index));
                  }
                  parts.push(
                    <span
                      key={match.index}
                      className="bg-indigo-500/20 text-indigo-400 rounded px-0.5"
                    >
                      {match[1]}
                    </span>,
                  );
                  parts.push(match[2]); // trailing space
                  lastIdx = match.index + match[0].length;
                }
                if (lastIdx < text.length) {
                  parts.push(text.slice(lastIdx));
                }
                return parts;
              })()}
            </div>
          )}
          <textarea
            ref={textareaRef}
            disabled={!canSendMessages}
            value={inputText}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onScroll={syncHighlightScroll}
            placeholder={
              canSendMessages
                ? placeholder
                : "You do not have permission to send messages in this channel."
            }
            aria-label={placeholder}
            rows={1}
            className={`w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none text-sm placeholder-text-muted resize-none max-h-[250px] py-1.5 min-h-[36px] no-scrollbar leading-relaxed relative z-[1] ${
              mentionsMapRef.current.size > 0
                ? "text-text-primary caret-text-primary"
                : "text-text-primary"
            }`}
          />
        </div>

        <div className="flex items-center gap-1.5 mb-0.5 relative">
          <button
            type="button"
            className="text-text-secondary hover:text-text-primary p-1.5 rounded cursor-pointer transition-colors"
            title="Upload attachments"
            aria-label="Upload attachments"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4.5 w-4.5" />
          </button>

          <button
            type="submit"
            disabled={!canSend}
            className={`p-1.5 ml-1 rounded-lg flex items-center justify-center transition-colors ${
              canSend
                ? "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-md shadow-indigo-600/20"
                : "text-text-muted bg-bg-primary/20"
            }`}
            title="Send Message"
            aria-label="Send Message"
          >
            <Send className="h-4 w-4 ml-0.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
