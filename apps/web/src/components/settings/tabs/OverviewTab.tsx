"use client";

import React, { useState } from "react";
import { useGuildPermissions } from "../../../hooks/usePermissions";
import { guildsApi } from "../../../services/api/guilds";
import MediaUploadControl from "../MediaUploadControl";
import { useSettingsForm } from "../../../hooks/useSettingsForm";
import UnsavedChangesBar from "../UnsavedChangesBar";
import { Guild } from "../../../types";
import { useQueryClient } from "@tanstack/react-query";
import { GUILDS_QUERY_KEY } from "../../../services/query/useGuilds";
import { mediaApi } from "../../../services/api/media";
import { getMediaUrl } from "../../../lib/media";

interface OverviewTabProps {
  activeGuild: Guild;
}

export default function OverviewTab({ activeGuild }: OverviewTabProps) {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const { canManageGuild } = useGuildPermissions(activeGuild?.permissions);

  const { data, isDirty, handleChange, reset } = useSettingsForm({
    name: activeGuild.name || "",
    description: activeGuild.description || "",
    iconUploadId: null as string | null,
    bannerUploadId: null as string | null,
    removeIcon: false,
    removeBanner: false,
  });

  const handleDiscard = async () => {
    if (data.iconUploadId) {
      await mediaApi.cancelUpload(data.iconUploadId).catch(console.error);
    }
    if (data.bannerUploadId) {
      await mediaApi.cancelUpload(data.bannerUploadId).catch(console.error);
    }
    reset();
  };

  const savedUploadIdsRef = React.useRef<Set<string>>(new Set());
  const iconUploadIdRef = React.useRef<string | null>(null);
  const bannerUploadIdRef = React.useRef<string | null>(null);

  // Keep refs in sync with form state
  React.useEffect(() => {
    iconUploadIdRef.current = data.iconUploadId;
    bannerUploadIdRef.current = data.bannerUploadId;
  }, [data.iconUploadId, data.bannerUploadId]);

  // Cleanup only on unmount — cancel any unsaved pending uploads
  React.useEffect(() => {
    const saved = savedUploadIdsRef.current;
    return () => {
      const iconId = iconUploadIdRef.current;
      const bannerId = bannerUploadIdRef.current;
      if (iconId && !saved.has(iconId)) {
        mediaApi.cancelUpload(iconId).catch(() => {});
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
      if (data.name !== activeGuild.name) payload.name = data.name;
      if (data.description !== activeGuild.description) payload.description = data.description;

      if (data.iconUploadId) payload.icon_upload_id = data.iconUploadId;
      if (data.removeIcon) payload.remove_icon = true;

      if (data.bannerUploadId) payload.banner_upload_id = data.bannerUploadId;
      if (data.removeBanner) payload.remove_banner = true;

      await guildsApi.updateGuild(activeGuild.id, payload);
      queryClient.invalidateQueries({ queryKey: GUILDS_QUERY_KEY });

      // Mark these uploads as saved so cleanup won't cancel them
      if (data.iconUploadId) savedUploadIdsRef.current.add(data.iconUploadId);
      if (data.bannerUploadId) savedUploadIdsRef.current.add(data.bannerUploadId);

      handleChange("iconUploadId", null);
      handleChange("bannerUploadId", null);
      reset();
    } catch (err) {
      console.error("Failed to save guild overview", err);
    } finally {
      setIsSaving(false);
    }
  };

  const currentIconUrl = data.removeIcon
    ? null
    : activeGuild.icon_key
      ? getMediaUrl(activeGuild.icon_key) || null
      : null;

  const currentBannerUrl = data.removeBanner
    ? null
    : activeGuild.banner_key
      ? getMediaUrl(activeGuild.banner_key) || null
      : null;

  return (
    <div className="space-y-5 pb-20">
      <div className="border-b border-border-custom pb-3">
        <h3 className="text-sm font-semibold text-text-primary">Server Overview</h3>
        <p className="text-[11px] text-text-muted mt-0.5 font-normal">
          Manage server identity and appearance.
        </p>
      </div>

      <div className="space-y-4">
        {/* Banner Upload */}
        <div
          className="relative bg-bg-secondary rounded p-3 space-y-2"
          title={!canManageGuild ? "You need MANAGE_GUILD permission to change the banner." : ""}
        >
          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider">
            Server Banner Background
          </label>
          <MediaUploadControl
            category="guild-banner"
            guildId={activeGuild.id}
            aspectRatio="video"
            currentUrl={currentBannerUrl}
            disabled={!canManageGuild}
            onUploadSuccess={(id) => {
              if (data.bannerUploadId)
                mediaApi.cancelUpload(data.bannerUploadId).catch(console.error);
              handleChange("bannerUploadId", id);
              handleChange("removeBanner", false);
            }}
            onRemove={() => handleChange("removeBanner", true)}
          />
        </div>

        {/* Icon Upload */}
        <div
          className="relative bg-bg-secondary rounded p-3 space-y-2"
          title={!canManageGuild ? "You need MANAGE_GUILD permission to change the icon." : ""}
        >
          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider">
            Server Icon
          </label>
          <div className="flex justify-start">
            <MediaUploadControl
              category="guild-icon"
              guildId={activeGuild.id}
              aspectRatio="square"
              currentUrl={currentIconUrl}
              disabled={!canManageGuild}
              onUploadSuccess={(id) => {
                if (data.iconUploadId)
                  mediaApi.cancelUpload(data.iconUploadId).catch(console.error);
                handleChange("iconUploadId", id);
                handleChange("removeIcon", false);
              }}
              onRemove={() => handleChange("removeIcon", true)}
            />
          </div>
        </div>

        {/* Name */}
        <div
          className="relative bg-bg-secondary rounded p-3 space-y-1.5"
          title={!canManageGuild ? "You need MANAGE_GUILD permission to change the name." : ""}
        >
          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider">
            Server Name
          </label>
          <input
            type="text"
            className="w-full bg-bg-tertiary border border-border-custom rounded px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            value={data.name}
            onChange={(e) => handleChange("name", e.target.value)}
            disabled={!canManageGuild}
            maxLength={100}
          />
        </div>

        {/* Description */}
        <div
          className="relative bg-bg-secondary rounded p-3 space-y-1.5"
          title={
            !canManageGuild ? "You need MANAGE_GUILD permission to change the description." : ""
          }
        >
          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider">
            Server Description
          </label>
          <textarea
            className="w-full bg-bg-tertiary border border-border-custom rounded px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-indigo-500 min-h-[80px] resize-y disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            value={data.description}
            onChange={(e) => handleChange("description", e.target.value)}
            placeholder="What is this server about?"
            maxLength={500}
            disabled={!canManageGuild}
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
