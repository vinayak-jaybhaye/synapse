"use client";

import React, { useState } from "react";
import { useAuthStore } from "../../../store/auth-store";
import { usersApi } from "../../../services/api/users";
import MediaUploadControl from "../MediaUploadControl";
import { useSettingsForm } from "../../../hooks/useSettingsForm";
import UnsavedChangesBar from "../UnsavedChangesBar";
import { mediaApi } from "../../../services/api/media";

export default function ProfileTab() {
  const { user, setUser } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);

  const { data, isDirty, handleChange, reset } = useSettingsForm({
    displayName: user?.display_name || "",
    bio: user?.bio || "",
    avatarUploadId: null as string | null,
    bannerUploadId: null as string | null,
    removeAvatar: false,
    removeBanner: false,
  });

  const handleDiscard = async () => {
    if (data.avatarUploadId) {
      await mediaApi.cancelUpload(data.avatarUploadId).catch(console.error);
    }
    if (data.bannerUploadId) {
      await mediaApi.cancelUpload(data.bannerUploadId).catch(console.error);
    }
    reset();
  };

  React.useEffect(() => {
    return () => {
      // Best-effort cleanup on unmount
      if (data.avatarUploadId) mediaApi.cancelUpload(data.avatarUploadId).catch(() => {});
      if (data.bannerUploadId) mediaApi.cancelUpload(data.bannerUploadId).catch(() => {});
    };
  }, [data.avatarUploadId, data.bannerUploadId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: any = {};
      if (data.displayName !== user?.display_name) payload.display_name = data.displayName;
      if (data.bio !== user?.bio) payload.bio = data.bio;
      
      if (data.avatarUploadId) payload.avatar_upload_id = data.avatarUploadId;
      if (data.removeAvatar) payload.remove_avatar = true;

      if (data.bannerUploadId) payload.banner_upload_id = data.bannerUploadId;
      if (data.removeBanner) payload.remove_banner = true;

      const updatedUser = await usersApi.updateProfile(payload);
      setUser(updatedUser);
      handleChange("avatarUploadId", null);
      handleChange("bannerUploadId", null);
      reset();
    } catch (err) {
      console.error("Failed to save profile", err);
    } finally {
      setIsSaving(false);
    }
  };

  const currentAvatarUrl = data.removeAvatar 
    ? null 
    : (user?.avatar_key ? `http://localhost:4566/synapse-bucket/${user.avatar_key}` : null);

  const currentBannerUrl = data.removeBanner 
    ? null 
    : (user?.banner_key ? `http://localhost:4566/synapse-bucket/${user.banner_key}` : null);

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h3 className="text-xl font-bold text-text-primary">My Profile</h3>
        <p className="text-xs text-text-muted mt-1">Manage your identity details.</p>
      </div>

      <div className="space-y-8">
        {/* Banner Upload */}
        <div>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Profile Banner</label>
          <MediaUploadControl
            category="banner"
            aspectRatio="video"
            currentUrl={currentBannerUrl}
            onUploadSuccess={(id) => {
              if (data.bannerUploadId) mediaApi.cancelUpload(data.bannerUploadId).catch(console.error);
              handleChange("bannerUploadId", id);
              handleChange("removeBanner", false);
            }}
            onRemove={() => handleChange("removeBanner", true)}
          />
        </div>

        {/* Avatar Upload */}
        <div>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Avatar</label>
          <MediaUploadControl
            category="avatar"
            aspectRatio="square"
            currentUrl={currentAvatarUrl}
            onUploadSuccess={(id) => {
              if (data.avatarUploadId) mediaApi.cancelUpload(data.avatarUploadId).catch(console.error);
              handleChange("avatarUploadId", id);
              handleChange("removeAvatar", false);
            }}
            onRemove={() => handleChange("removeAvatar", true)}
          />
        </div>

        {/* Display Name */}
        <div>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Display Name</label>
          <input
            type="text"
            className="w-full bg-bg-tertiary border border-border-custom rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500"
            value={data.displayName}
            onChange={(e) => handleChange("displayName", e.target.value)}
            placeholder={user?.username}
          />
        </div>

        {/* Username (Read Only for now, typically requires password confirmation) */}
        <div>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Username</label>
          <input
            type="text"
            className="w-full bg-bg-tertiary border border-border-custom rounded-md px-3 py-2 text-sm text-text-secondary opacity-70 cursor-not-allowed"
            value={user?.username || ""}
            disabled
          />
        </div>

        {/* Bio */}
        <div>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">About Me</label>
          <textarea
            className="w-full bg-bg-tertiary border border-border-custom rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500 min-h-[100px] resize-y"
            value={data.bio}
            onChange={(e) => handleChange("bio", e.target.value)}
            placeholder="Tell everyone a little bit about yourself..."
            maxLength={190}
          />
        </div>
      </div>

      <UnsavedChangesBar
        show={isDirty}
        onSave={handleSave}
        onDiscard={handleDiscard}
        isSaving={isSaving}
      />
    </div>
  );
}
