"use client";

import React, { useEffect } from "react";
import { X, Download, Maximize2 } from "lucide-react";
import { createPortal } from "react-dom";

interface MediaViewerModalProps {
  url: string;
  fileName: string;
  isOpen: boolean;
  isVideo?: boolean;
  onClose: () => void;
}

export default function MediaViewerModal({
  url,
  fileName,
  isOpen,
  onClose,
  isVideo,
}: MediaViewerModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Top Toolbar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between text-white/80 z-10 bg-gradient-to-b from-black/60 to-transparent">
        <div className="truncate font-medium max-w-md">{fileName}</div>
        <div className="flex items-center gap-4">
          <a
            href={url}
            download={fileName}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors cursor-pointer"
            title="Open Original"
          >
            <Maximize2 className="h-5 w-5" />
          </a>
          <button
            onClick={onClose}
            className="hover:text-white transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo ? (
          <video
            src={url}
            controls
            autoPlay
            className="max-w-full max-h-[90vh] object-contain rounded drop-shadow-2xl"
          />
        ) : (
          <img
            src={url}
            alt={fileName}
            className="max-w-full max-h-[90vh] object-contain rounded drop-shadow-2xl"
          />
        )}
      </div>

      {/* Background click listener */}
      <div className="absolute inset-0 z-[-1]" onClick={onClose} />
    </div>,
    document.body,
  );
}
