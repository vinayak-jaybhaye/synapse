/* eslint-disable @next/next/no-img-element */
"use client";
import React, { useState, useRef } from "react";
import { Camera, X, RefreshCw } from "lucide-react";
import { mediaApi } from "../../services/api/media";
import { normalizeError } from "../../lib/api";

export type UploadCategory = "avatar" | "banner" | "guild-icon" | "guild-banner";

interface MediaUploadControlProps {
  category: UploadCategory;
  guildId?: string;
  currentUrl?: string | null;
  onUploadSuccess: (uploadId: string) => void;
  onRemove: () => void;
  onPreviewChange?: (url: string | null) => void; // live preview callback
  aspectRatio?: "square" | "video"; // banner vs icon
  disabled?: boolean;
}

export default function MediaUploadControl({
  category,
  guildId,
  currentUrl,
  onUploadSuccess,
  onRemove,
  onPreviewChange,
  aspectRatio = "square",
  disabled = false,
}: MediaUploadControlProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayUrl = previewUrl || currentUrl;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset error
    setError(null);
    setIsUploading(true);
    setProgress(0);

    // Validate size before doing anything
    const MB = 1024 * 1024;
    let maxSize = 10 * MB; // default 10MB for avatar, guild-icon
    if (category === "banner" || category === "guild-banner") {
      maxSize = 20 * MB;
    }

    if (file.size > maxSize) {
      setError(`File is too large (max ${maxSize / MB}MB)`);
      setIsUploading(false);
      return;
    }

    // Create a local preview immediately
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    onPreviewChange?.(localUrl);

    try {
      const extMatch = file.name.match(/(\.[^.]+)$/);
      const extension = extMatch ? extMatch[1] : "";

      const payload = {
        category,
        extension,
        file_name: file.name,
        size: file.size,
        content_type: file.type || "application/octet-stream",
      };

      let uploadInfo;
      if (category === "avatar") {
        uploadInfo = await mediaApi.generateAvatarUploadUrl(payload);
      } else if (category === "banner") {
        uploadInfo = await mediaApi.generateUserBannerUploadUrl(payload);
      } else if (category === "guild-icon" && guildId) {
        uploadInfo = await mediaApi.generateGuildIconUploadUrl(guildId, payload);
      } else if (category === "guild-banner" && guildId) {
        uploadInfo = await mediaApi.generateGuildBannerUploadUrl(guildId, payload);
      } else {
        throw new Error("Invalid category or missing guild ID");
      }

      const { upload_url, upload_id } = uploadInfo;

      await mediaApi.uploadFileToS3(upload_url, file, (progressEvent) => {
        if (progressEvent.total) {
          setProgress((progressEvent.loaded * 100) / progressEvent.total);
        }
      });

      // Mark the upload as completed on the backend
      await mediaApi.markUploadComplete(upload_id);

      // Pass the upload ID back
      onUploadSuccess(upload_id);
    } catch (err: unknown) {
      console.error("Upload failed", err);
      setError(normalizeError(err).message);
      setPreviewUrl(null);
      onPreviewChange?.(null);
      if (localUrl) URL.revokeObjectURL(localUrl);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setPreviewUrl(null);
    onPreviewChange?.(null);
    onRemove();
  };

  const containerClass =
    aspectRatio === "square"
      ? "w-24 h-24 rounded-full overflow-hidden"
      : "w-full h-32 rounded-lg overflow-hidden";

  return (
    <div className="relative flex flex-col items-center">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
      />

      <div
        className={`relative bg-bg-tertiary flex items-center justify-center cursor-pointer group shadow-sm hover:shadow-md transition-shadow ${containerClass} ${disabled || isUploading ? "opacity-70 pointer-events-none" : ""}`}
        onClick={() => fileInputRef.current?.click()}
      >
        {displayUrl ? (
          <img src={displayUrl} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center text-text-muted group-hover:text-text-primary transition-colors">
            <Camera className="w-8 h-8 mb-1" />
          </div>
        )}

        {/* Hover overlay */}
        {!disabled && !isUploading && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <span className="text-white text-xs font-semibold tracking-wider uppercase">
              Change
            </span>
          </div>
        )}

        {/* Upload Progress Overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-4">
            <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-indigo-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-white text-[10px]">{Math.round(progress)}%</span>
          </div>
        )}

        {/* Remove Button */}
        {displayUrl && !disabled && !isUploading && (
          <button
            type="button"
            className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleRemoveClick}
            title="Remove Image"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {error && (
        <div className="mt-2 text-red-500 text-xs flex items-center gap-1 bg-red-500/10 px-2 py-1 rounded">
          <RefreshCw className="w-3 h-3" />
          {error}
        </div>
      )}
    </div>
  );
}
