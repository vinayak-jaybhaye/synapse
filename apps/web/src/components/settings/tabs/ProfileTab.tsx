/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState } from "react";
import { LogOut, User, ShieldBan } from "lucide-react";
import { useAuthStore } from "../../../store/auth-store";
import { usersApi } from "../../../services/api/users";
import { useBlockedUsers, useUnblockUser } from "../../../services/query/useBlocks";
import { useUserProfile } from "../../../features/profile/api/use-profile";
import MediaUploadControl from "../MediaUploadControl";
import { useSettingsForm } from "../../../hooks/useSettingsForm";
import UnsavedChangesBar from "../UnsavedChangesBar";
import { mediaApi } from "../../../services/api/media";
import { getMediaUrl } from "../../../lib/media";

function BlockedUserItem({ userId }: { userId: string }) {
  const { data: profile, isLoading } = useUserProfile(userId, true);
  const { mutate: unblock, isPending } = useUnblockUser();

  if (isLoading) {
    return <div className="animate-pulse bg-bg-tertiary h-10 rounded"></div>;
  }
  if (!profile) return null;

  return (
    <div className="flex items-center justify-between p-2 rounded bg-bg-tertiary border border-border-custom">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
          {profile.avatar_key ? (
            <img
              src={getMediaUrl(profile.avatar_key)}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            profile.username.charAt(0).toUpperCase()
          )}
        </div>
        <div className="text-xs">
          <p className="font-bold text-text-primary">{profile.display_name || profile.username}</p>
          <p className="text-text-muted">@{profile.username}</p>
        </div>
      </div>
      <button
        onClick={() => unblock(userId)}
        disabled={isPending}
        className="px-2 py-1 text-[10px] font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded disabled:opacity-50 transition-colors"
      >
        Unblock
      </button>
    </div>
  );
}

export default function ProfileTab() {
  const { user, setUser, logout } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const { data: blockedUsers } = useBlockedUsers();

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
    setAvatarPreview(null);
    setBannerPreview(null);
    reset();
  };

  const savedUploadIdsRef = React.useRef<Set<string>>(new Set());
  const avatarUploadIdRef = React.useRef<string | null>(null);
  const bannerUploadIdRef = React.useRef<string | null>(null);

  // Keep refs in sync with form state
  React.useEffect(() => {
    avatarUploadIdRef.current = data.avatarUploadId;
    bannerUploadIdRef.current = data.bannerUploadId;
  }, [data.avatarUploadId, data.bannerUploadId]);

  // Cleanup only on unmount — cancel any unsaved pending uploads
  React.useEffect(() => {
    const saved = savedUploadIdsRef.current;
    return () => {
      const avatarId = avatarUploadIdRef.current;
      const bannerId = bannerUploadIdRef.current;
      if (avatarId && !saved.has(avatarId)) {
        mediaApi.cancelUpload(avatarId).catch(() => {});
      }
      if (bannerId && !saved.has(bannerId)) {
        mediaApi.cancelUpload(bannerId).catch(() => {});
      }
    };
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (data.displayName !== user?.display_name) payload.display_name = data.displayName;
      if (data.bio !== user?.bio) payload.bio = data.bio;

      if (data.avatarUploadId) payload.avatar_upload_id = data.avatarUploadId;
      if (data.removeAvatar) payload.remove_avatar = true;

      if (data.bannerUploadId) payload.banner_upload_id = data.bannerUploadId;
      if (data.removeBanner) payload.remove_banner = true;

      const updatedUser = await usersApi.updateProfile(payload);
      setUser(updatedUser);

      // Mark these uploads as saved so cleanup won't cancel them
      if (data.avatarUploadId) savedUploadIdsRef.current.add(data.avatarUploadId);
      if (data.bannerUploadId) savedUploadIdsRef.current.add(data.bannerUploadId);

      handleChange("avatarUploadId", null);
      handleChange("bannerUploadId", null);
      setAvatarPreview(null);
      setBannerPreview(null);
      reset();
    } catch (err) {
      console.error("Failed to save profile", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Determine current image sources for inputs and live preview
  const currentAvatarUrl = data.removeAvatar
    ? null
    : user?.avatar_key
      ? getMediaUrl(user.avatar_key) || null
      : null;

  const currentBannerUrl = data.removeBanner
    ? null
    : user?.banner_key
      ? getMediaUrl(user.banner_key) || null
      : null;

  const previewAvatarUrl = data.removeAvatar ? null : avatarPreview || currentAvatarUrl;

  const previewBannerUrl = data.removeBanner ? null : bannerPreview || currentBannerUrl;

  const joinedDate = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="border-b border-border-custom pb-3">
        <div className="flex items-center gap-1.5">
          <User className="h-4 w-4 text-text-secondary" />
          <h3 className="text-sm font-semibold text-text-primary">Profile</h3>
        </div>
        <p className="text-[11px] text-text-muted mt-0.5">
          Customize your display identity, bio, and profile graphics.
        </p>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Left Form (Col span 3) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Banner Upload Card */}
          <div className="bg-bg-secondary rounded p-3 space-y-2">
            <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider">
              Profile Banner
            </label>
            <MediaUploadControl
              category="banner"
              aspectRatio="video"
              currentUrl={currentBannerUrl}
              onUploadSuccess={(id) => {
                if (data.bannerUploadId)
                  mediaApi.cancelUpload(data.bannerUploadId).catch(console.error);
                handleChange("bannerUploadId", id);
                handleChange("removeBanner", false);
              }}
              onPreviewChange={setBannerPreview}
              onRemove={() => handleChange("removeBanner", true)}
            />
          </div>

          {/* Avatar Upload Card */}
          <div className="bg-bg-secondary rounded p-3 flex flex-col sm:flex-row items-center gap-3">
            <MediaUploadControl
              category="avatar"
              aspectRatio="square"
              currentUrl={currentAvatarUrl}
              onUploadSuccess={(id) => {
                if (data.avatarUploadId)
                  mediaApi.cancelUpload(data.avatarUploadId).catch(console.error);
                handleChange("avatarUploadId", id);
                handleChange("removeAvatar", false);
              }}
              onPreviewChange={setAvatarPreview}
              onRemove={() => handleChange("removeAvatar", true)}
            />
            <div className="text-center sm:text-left space-y-0.5">
              <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                Avatar Image
              </label>
              <p className="text-[10px] text-text-muted">
                JPG, PNG, GIF or WebP. Recommend square dimensions.
              </p>
            </div>
          </div>

          {/* Form Fields Card */}
          <div className="bg-bg-secondary rounded p-3 space-y-3">
            {/* Display Name */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                Display Name
              </label>
              <input
                type="text"
                className="w-full bg-bg-tertiary border border-border-custom rounded px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-indigo-500 transition-colors"
                value={data.displayName}
                onChange={(e) => handleChange("displayName", e.target.value)}
                placeholder={user?.username}
              />
            </div>

            {/* Username */}
            <div className="space-y-1 opacity-80">
              <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                Username
              </label>
              <input
                type="text"
                className="w-full bg-bg-tertiary/60 border border-border-custom rounded px-2.5 py-1.5 text-xs text-text-secondary cursor-not-allowed select-all"
                value={user?.username || ""}
                disabled
              />
            </div>

            {/* Bio */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                About Me
              </label>
              <textarea
                className="w-full bg-bg-tertiary border border-border-custom rounded px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-indigo-500 min-h-[80px] resize-y transition-colors"
                value={data.bio}
                onChange={(e) => handleChange("bio", e.target.value)}
                placeholder="Tell everyone a little bit about yourself..."
                maxLength={190}
              />
            </div>
          </div>

          {/* Account Actions */}
          <div className="bg-bg-secondary rounded p-3 space-y-2">
            <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider">
              Account Actions
            </label>
            <div>
              <button
                onClick={() => logout()}
                type="button"
                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <LogOut className="h-3.5 w-3.5" />
                Log Out
              </button>
            </div>
          </div>

          {/* Blocked Users */}
          <div className="bg-bg-secondary rounded p-3 space-y-2">
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-text-secondary uppercase tracking-wider">
              <ShieldBan className="h-3.5 w-3.5" />
              Blocked Users
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar pr-1">
              {blockedUsers && blockedUsers.length > 0 ? (
                blockedUsers.map((id) => <BlockedUserItem key={id} userId={id} />)
              ) : (
                <p className="text-xs text-text-muted py-2">You haven&apos;t blocked anyone.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Preview Card (Col span 2) */}
        <div className="lg:col-span-2 flex flex-col items-center gap-2 lg:sticky lg:top-4">
          <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider select-none">
            Live Preview
          </span>

          {/* User Profile Card Replica */}
          <div className="w-full max-w-[240px] bg-[#18191c] border border-border-custom rounded overflow-hidden shadow flex flex-col text-text-primary select-none">
            {/* Banner */}
            <div
              className={`h-20 w-full shrink-0 ${!previewBannerUrl ? "bg-indigo-600" : ""}`}
              style={
                previewBannerUrl
                  ? {
                      backgroundImage: `url(${previewBannerUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : {}
              }
            />

            {/* Body */}
            <div className="px-3 pb-3 min-w-0">
              {/* Avatar */}
              <div className="relative -mt-8 mb-2 flex justify-between items-end">
                <div className="w-16 h-16 rounded-full border-[3px] border-[#18191c] bg-indigo-500 flex items-center justify-center font-bold text-white text-xl overflow-hidden relative shrink-0">
                  {previewAvatarUrl ? (
                    <img src={previewAvatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    user?.username?.charAt(0).toUpperCase() || "?"
                  )}
                </div>
              </div>

              {/* User Info */}
              <div className="mb-2.5 min-w-0">
                <h2 className="text-sm font-bold leading-tight truncate text-text-primary">
                  {data.displayName || user?.display_name || user?.username || "Guest User"}
                </h2>
                <p className="text-[11px] text-text-muted truncate">
                  @{user?.username || "username"}
                </p>
              </div>

              <div className="h-px bg-border-custom w-full my-2.5" />

              {/* Bio */}
              {(data.bio || user?.bio) && (
                <div className="mb-3 max-h-[60px] overflow-y-auto no-scrollbar min-w-0">
                  <h3 className="text-[9px] font-bold text-text-primary uppercase tracking-wider mb-0.5">
                    About Me
                  </h3>
                  <p className="text-[11px] text-text-secondary whitespace-pre-wrap break-words">
                    {data.bio || user?.bio}
                  </p>
                </div>
              )}

              {/* Joined Date */}
              <div className="min-w-0">
                <h3 className="text-[9px] font-bold text-text-primary uppercase tracking-wider mb-0.5">
                  Member Since
                </h3>
                <p className="text-[11px] text-text-secondary truncate">{joinedDate}</p>
              </div>
            </div>
          </div>
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
