import React from "react";
import { PendingUploadState } from "../../types";
import { X, File, AlertCircle, RefreshCw } from "lucide-react";

interface UploadAttachmentItemProps {
  upload: PendingUploadState;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

export default function UploadAttachmentItem({
  upload,
  onRemove,
  onRetry,
}: UploadAttachmentItemProps) {
  const isImage = upload.file.type.startsWith("image/");
  const isVideo = upload.file.type.startsWith("video/");

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="relative group w-48 h-48 bg-bg-secondary border border-border-custom rounded-xl overflow-hidden shadow-sm shrink-0">
      {/* Remove Button */}
      <button
        onClick={() => onRemove(upload.id)}
        className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black text-white rounded-md z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove attachment"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Content Preview */}
      <div className="w-full h-full flex flex-col">
        {isImage && upload.previewUrl ? (
          <div className="w-full h-full bg-black flex-1 flex items-center justify-center overflow-hidden">
            <img
              src={upload.previewUrl}
              alt={upload.file.name}
              className={`w-full h-full object-cover ${
                upload.state === "UPLOADING" || upload.state === "QUEUED" ? "opacity-50 blur-sm" : ""
              } transition-all`}
            />
          </div>
        ) : isVideo && upload.previewUrl ? (
          <div className="w-full h-full bg-black flex-1 flex items-center justify-center overflow-hidden">
            <video
              src={upload.previewUrl}
              className={`w-full h-full object-cover ${
                upload.state === "UPLOADING" || upload.state === "QUEUED" ? "opacity-50 blur-sm" : ""
              } transition-all`}
            />
          </div>
        ) : (
          <div className="w-full h-full bg-bg-tertiary flex-1 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <File className="w-10 h-10 text-text-muted" />
            <span className="text-xs font-medium text-text-secondary line-clamp-2 break-all">
              {upload.file.name}
            </span>
            <span className="text-[10px] text-text-muted">
              {formatSize(upload.file.size)}
            </span>
          </div>
        )}
      </div>

      {/* Progress & States Overlay */}
      {(upload.state === "UPLOADING" || upload.state === "QUEUED") && (
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-semibold text-white/90 uppercase tracking-wider">
              {upload.state}
            </span>
            <span className="text-[10px] font-mono text-white">
              {Math.round(upload.progress)}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${upload.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Failed State Overlay */}
      {upload.state === "FAILED" && (
        <div className="absolute inset-0 bg-red-950/80 flex flex-col items-center justify-center p-4">
          <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
          <span className="text-xs font-semibold text-red-200 text-center mb-3">
            Upload Failed
          </span>
          <button
            onClick={() => onRetry(upload.id)}
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-md font-medium transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
