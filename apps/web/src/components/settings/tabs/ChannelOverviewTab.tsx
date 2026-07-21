"use client";

import React, { useState } from "react";
import { useGuildPermissions } from "../../../hooks/usePermissions";
import { useGuildStore } from "../../../store/guild-store";
import { useGuilds } from "../../../services/query/useGuilds";
import { channelsApi } from "../../../services/api/channels";
import { useSettingsForm } from "../../../hooks/useSettingsForm";
import { normalizeError } from "../../../lib/api";
import { useUIStore } from "../../../store/ui-store";
import UnsavedChangesBar from "../UnsavedChangesBar";
import { Channel } from "../../../types";

interface ChannelOverviewTabProps {
  activeChannel: Channel;
}

export default function ChannelOverviewTab({ activeChannel }: ChannelOverviewTabProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { activeGuildId } = useGuildStore();
  const { guilds } = useGuilds();

  const activeGuild = guilds.find((g) => g.id === activeGuildId);
  const { canManageChannels } = useGuildPermissions(activeGuild?.permissions);

  const { data, isDirty, handleChange, reset } = useSettingsForm({
    name: activeChannel.name || "",
    topic: activeChannel.topic || "",
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: any = {};
      if (data.name !== activeChannel.name) payload.name = data.name;
      if (data.topic !== activeChannel.topic) payload.topic = data.topic;

      await channelsApi.updateChannel(activeChannel.id, payload);
      reset();
    } catch (err: unknown) {
      useUIStore.getState().showToast(normalizeError(err).message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-20 overflow-y-auto h-full pr-1">
      <div className="border-b border-border-custom pb-3">
        <h3 className="text-sm font-semibold text-text-primary">Overview</h3>
        <p className="text-[11px] text-text-muted mt-0.5 font-normal">
          Manage general configurations and topic settings.
        </p>
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div
          className="relative bg-bg-secondary rounded p-3 space-y-1.5"
          title={
            !canManageChannels ? "You need MANAGE_CHANNELS permission to change the name." : ""
          }
        >
          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider">
            Channel Name
          </label>
          <div className="relative">
            <span className="absolute left-2.5 top-1.5 text-xs text-text-muted select-none">#</span>
            <input
              type="text"
              className="w-full bg-bg-tertiary border border-border-custom rounded pl-6 pr-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              value={data.name}
              onChange={(e) =>
                handleChange("name", e.target.value.toLowerCase().replace(/\s+/g, "-"))
              }
              disabled={!canManageChannels}
              maxLength={100}
            />
          </div>
        </div>

        {/* Topic */}
        <div
          className="relative bg-bg-secondary  rounded p-3 space-y-1.5"
          title={
            !canManageChannels ? "You need MANAGE_CHANNELS permission to change the topic." : ""
          }
        >
          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider">
            Channel Topic
          </label>
          <textarea
            className="w-full bg-bg-tertiary border border-border-custom rounded px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-indigo-500 min-h-[80px] resize-y disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            value={data.topic}
            onChange={(e) => handleChange("topic", e.target.value)}
            placeholder="Let everyone know how to use this channel!"
            maxLength={1024}
            disabled={!canManageChannels}
          />
        </div>
      </div>

      <UnsavedChangesBar show={isDirty} onSave={handleSave} onDiscard={reset} isSaving={isSaving} />
    </div>
  );
}
