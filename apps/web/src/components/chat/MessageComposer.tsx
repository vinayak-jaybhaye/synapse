"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useUIStore } from "../../store/ui-store";
import { Paperclip, Smile, Send, Sparkles } from "lucide-react";
import EmojiPickerPopover from "./EmojiPickerPopover";
import UploadAttachmentItem from "./UploadAttachmentItem";
import { PendingUploadState } from "../../types";
import { useChannelPermissions } from "../../hooks/usePermissions";
import { mediaApi } from "../../services/api/media";

interface MessageComposerProps {
  channelId: string;
  placeholder: string;
  onSend: (content: string, uploadIds?: string[]) => Promise<void>;
  draftKey?: string;
  permissions?: string;
  isDM?: boolean;
}

export default function MessageComposer({
  channelId,
  placeholder,
  onSend,
  draftKey,
  permissions,
  isDM,
}: MessageComposerProps) {
  const { drafts, setDraft } = useUIStore();
  const [inputText, setInputText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingUploadState[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const {
    canSendMessages,
    canAttachFiles,
    canEmbedLinks,
    canMentionEveryone,
    canUseExternalEmojis,
    canUseExternalStickers,
  } = useChannelPermissions(permissions, isDM);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(textareaRef.current.scrollHeight, 250);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);
    if (draftKey) {
      setDraft(draftKey, val);
    }
    adjustTextareaHeight();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

    const textToSend = inputText.trim();
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
      // Clean up object URLs
      completedUploads.forEach((u) => {
        if (u.previewUrl) URL.revokeObjectURL(u.previewUrl);
      });
    } catch (err) {
      // Revert UI state on failure
      setInputText(textToSend);
      if (draftKey) {
        setDraft(draftKey, textToSend);
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
    } catch (error) {
      console.error("Upload failed for file", uploadState.file.name, error);
      setPendingUploads((prev) =>
        prev.map((u) => (u.id === uploadState.id ? { ...u, state: "FAILED" } : u)),
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

        <textarea
          ref={textareaRef}
          disabled={!canSendMessages}
          value={inputText}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={
            canSendMessages
              ? placeholder
              : "You do not have permission to send messages in this channel."
          }
          aria-label={placeholder}
          rows={1}
          className="flex-1 bg-transparent border-none outline-none text-text-primary text-sm placeholder-text-muted resize-none max-h-[250px] py-1.5 min-h-[36px] no-scrollbar leading-relaxed"
        />

        <div className="flex items-center gap-1.5 mb-0.5 relative">
          <button
            type="button"
            className="text-text-secondary hover:text-text-primary p-1.5 rounded cursor-pointer transition-colors hidden sm:block"
            title="Slash Commands / Mentions"
            aria-label="Slash Commands and Mentions"
          >
            <Sparkles className="h-4.5 w-4.5 text-indigo-400" />
          </button>

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
