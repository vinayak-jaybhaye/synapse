"use client";

import React, { useState } from "react";
import { useGuildPermissions } from "../../../hooks/usePermissions";
import { useGuildStore } from "../../../store/guild-store";
import { useGuilds } from "../../../services/query/useGuilds";
import { channelsApi } from "../../../services/api/channels";
import { useSettingsForm } from "../../../hooks/useSettingsForm";
import UnsavedChangesBar from "../UnsavedChangesBar";
import { Channel } from "../../../types";

interface ChannelOverviewTabProps {
  activeChannel: Channel;
}

export default function ChannelOverviewTab({ activeChannel }: ChannelOverviewTabProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { activeGuildId } = useGuildStore();
  const { guilds } = useGuilds();
  
  const activeGuild = guilds.find(g => g.id === activeGuildId);
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
    } catch (err) {
      console.error("Failed to save channel overview", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h3 className="text-xl font-bold text-text-primary">Overview</h3>
      </div>

      <div className="space-y-6">
        {/* Name */}
        <div className="relative group" title={!canManageChannels ? "You need MANAGE_CHANNELS permission to change the name." : ""}>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Channel Name</label>
          <input
            type="text"
            className="w-full bg-bg-tertiary border border-border-custom rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            value={data.name}
            onChange={(e) => handleChange("name", e.target.value.toLowerCase().replace(/\\s+/g, '-'))}
            disabled={!canManageChannels}
            maxLength={100}
          />
        </div>

        {/* Topic */}
        <div className="relative group" title={!canManageChannels ? "You need MANAGE_CHANNELS permission to change the topic." : ""}>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Channel Topic</label>
          <textarea
            className="w-full bg-bg-tertiary border border-border-custom rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500 min-h-[100px] resize-y disabled:opacity-50 disabled:cursor-not-allowed"
            value={data.topic}
            onChange={(e) => handleChange("topic", e.target.value)}
            placeholder="Let everyone know how to use this channel!"
            maxLength={1024}
            disabled={!canManageChannels}
          />
        </div>
      </div>

      <UnsavedChangesBar 
        show={isDirty} 
        onSave={handleSave} 
        onDiscard={reset} 
        isSaving={isSaving} 
      />
    </div>
  );
}
