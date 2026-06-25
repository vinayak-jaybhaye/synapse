"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUIStore } from "../../store/ui-store";
import { Paperclip, Smile, Send, Sparkles } from "lucide-react";
import EmojiPickerPopover from "./EmojiPickerPopover";

interface MessageComposerProps {
  placeholder: string;
  onSend: (content: string) => Promise<void>;
  draftKey?: string;
}

export default function MessageComposer({ placeholder, onSend, draftKey }: MessageComposerProps) {
  const { drafts, setDraft } = useUIStore();
  const [inputText, setInputText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

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

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      // Cap height to max 50vh or roughly 200px
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
    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const textToSend = inputText.trim();
    setInputText("");
    if (draftKey) {
      setDraft(draftKey, ""); // Clear cached draft
    }
    
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      await onSend(textToSend);
    } catch (err) {
      // Re-populate if message delivery failed
      setInputText(textToSend);
      if (draftKey) {
        setDraft(draftKey, textToSend);
      }
      setTimeout(adjustTextareaHeight, 0);
    }
  };

  const handleEmojiSelect = (emoji: { native: string }) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = inputText;

    // Insert emoji at cursor position
    const newText =
      currentText.substring(0, start) + emoji.native + currentText.substring(end);
    
    setInputText(newText);
    if (draftKey) {
      setDraft(draftKey, newText);
    }

    // Set cursor position right after the inserted emoji
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.native.length, start + emoji.native.length);
      adjustTextareaHeight();
    }, 0);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-bg-secondary border border-border-custom/80 rounded-xl px-4 py-2.5 flex items-end gap-3 transition-colors focus-within:border-indigo-500/70 relative"
    >
      {/* File Attachment Button (Future extension point placeholder) */}
      <button
        type="button"
        className="text-text-secondary hover:text-text-primary p-1.5 rounded cursor-pointer transition-colors mb-0.5"
        title="Upload attachments (Images, Video, Audio, Files)"
        aria-label="Upload attachments"
        onClick={() => alert("File attachments and media uploads are coming soon!")}
      >
        <Paperclip className="h-4.5 w-4.5" />
      </button>

      {/* Main Text Input (Auto-resizing Textarea) */}
      <textarea
        ref={textareaRef}
        value={inputText}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        rows={1}
        className="flex-1 bg-transparent border-none outline-none text-text-primary text-sm placeholder-text-muted resize-none max-h-[250px] py-1.5 min-h-[36px] no-scrollbar leading-relaxed"
      />

      {/* Action triggers (Emoji / Send / Slash commands) */}
      <div className="flex items-center gap-1.5 mb-0.5 relative">
        <button
          type="button"
          className="text-text-secondary hover:text-text-primary p-1.5 rounded cursor-pointer transition-colors hidden sm:block"
          title="Slash Commands / Mentions"
          aria-label="Slash Commands and Mentions"
          onClick={() => alert("Use slash commands and mentions to communicate efficiently!")}
        >
          <Sparkles className="h-4.5 w-4.5 text-indigo-400" />
        </button>

        <div className="relative flex items-center">
          <button
            ref={emojiButtonRef}
            type="button"
            className={`p-1.5 rounded cursor-pointer transition-colors ${
              showEmojiPicker ? "text-indigo-400 bg-bg-tertiary" : "text-text-secondary hover:text-text-primary"
            }`}
            title="Emoji Picker"
            aria-label="Toggle Emoji Picker"
            aria-haspopup="dialog"
            aria-expanded={showEmojiPicker}
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

        <button
          type="submit"
          disabled={!inputText.trim()}
          className={`p-1.5 ml-1 rounded-lg flex items-center justify-center transition-colors ${
            inputText.trim()
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
  );
}
