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

  React.useEffect(() => {
    return () => {
      // Best-effort cleanup on unmount
      if (data.iconUploadId) mediaApi.cancelUpload(data.iconUploadId).catch(() => {});
      if (data.bannerUploadId) mediaApi.cancelUpload(data.bannerUploadId).catch(() => {});
    };
  }, [data.iconUploadId, data.bannerUploadId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: any = {};
      if (data.name !== activeGuild.name) payload.name = data.name;
      if (data.description !== activeGuild.description) payload.description = data.description;
      
      if (data.iconUploadId) payload.icon_upload_id = data.iconUploadId;
      if (data.removeIcon) payload.remove_icon = true;

      if (data.bannerUploadId) payload.banner_upload_id = data.bannerUploadId;
      if (data.removeBanner) payload.remove_banner = true;

      await guildsApi.updateGuild(activeGuild.id, payload);
      queryClient.invalidateQueries({ queryKey: GUILDS_QUERY_KEY });
      // Clear data upload IDs so unmount effect doesn't cancel the ones we just saved
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
    : (activeGuild.icon_key ? `http://localhost:4566/synapse-bucket/${activeGuild.icon_key}` : null);

  const currentBannerUrl = data.removeBanner 
    ? null 
    : (activeGuild.banner_key ? `http://localhost:4566/synapse-bucket/${activeGuild.banner_key}` : null);

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h3 className="text-xl font-bold text-text-primary">Server Overview</h3>
        <p className="text-xs text-text-muted mt-1">Manage server identity and appearance.</p>
      </div>

      <div className="space-y-8">
        {/* Banner Upload */}
        <div className="relative group" title={!canManageGuild ? "You need MANAGE_GUILD permission to change the banner." : ""}>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Server Banner Background</label>
          <MediaUploadControl
            category="guild-banner"
            guildId={activeGuild.id}
            aspectRatio="video"
            currentUrl={currentBannerUrl}
            disabled={!canManageGuild}
            onUploadSuccess={(id) => {
              if (data.bannerUploadId) mediaApi.cancelUpload(data.bannerUploadId).catch(console.error);
              handleChange("bannerUploadId", id);
              handleChange("removeBanner", false);
            }}
            onRemove={() => handleChange("removeBanner", true)}
          />
        </div>

        {/* Icon Upload */}
        <div className="relative group" title={!canManageGuild ? "You need MANAGE_GUILD permission to change the icon." : ""}>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Server Icon</label>
          <MediaUploadControl
            category="guild-icon"
            guildId={activeGuild.id}
            aspectRatio="square"
            currentUrl={currentIconUrl}
            disabled={!canManageGuild}
            onUploadSuccess={(id) => {
              if (data.iconUploadId) mediaApi.cancelUpload(data.iconUploadId).catch(console.error);
              handleChange("iconUploadId", id);
              handleChange("removeIcon", false);
            }}
            onRemove={() => handleChange("removeIcon", true)}
          />
        </div>

        {/* Name */}
        <div className="relative group" title={!canManageGuild ? "You need MANAGE_GUILD permission to change the name." : ""}>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Server Name</label>
          <input
            type="text"
            className="w-full bg-bg-tertiary border border-border-custom rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            value={data.name}
            onChange={(e) => handleChange("name", e.target.value)}
            disabled={!canManageGuild}
            maxLength={100}
          />
        </div>

        {/* Description */}
        <div className="relative group" title={!canManageGuild ? "You need MANAGE_GUILD permission to change the description." : ""}>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Server Description</label>
          <textarea
            className="w-full bg-bg-tertiary border border-border-custom rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500 min-h-[100px] resize-y disabled:opacity-50 disabled:cursor-not-allowed"
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
