"use client";

import React from "react";
import { useUIStore } from "../../store/ui-store";
import { useChannels } from "../../services/query/useChannels";
import { Shield, X } from "lucide-react";
import ChannelPermissionsTab from "./tabs/ChannelPermissionsTab";
import { useGuildStore } from "../../store/guild-store";

export default function ChannelSettingsModal() {
  const {
    showChannelSettings,
    setShowChannelSettings,
    activeChannelSettingsId,
  } = useUIStore();
  
  const { activeGuildId } = useGuildStore();
  const { channels } = useChannels(activeGuildId || undefined);

  const activeChannel = channels.find((c) => c.id === activeChannelSettingsId);

  if (!showChannelSettings || !activeChannel) return null;

  return (
    <div className="fixed inset-0 bg-bg-primary z-50 flex flex-col md:flex-row font-sans select-none animate-in fade-in zoom-in-95 duration-200">
      {/* 1. Left Sidebar Navigation (Darker Background) */}
      <div className="w-full md:flex-1 md:max-w-[40%] lg:max-w-[35%] bg-bg-secondary flex justify-end border-r border-border-custom shadow-lg z-10">
        <div className="w-full max-w-[240px] pt-16 pb-10 px-4 md:px-0 md:pr-6 flex flex-col gap-1 overflow-y-auto no-scrollbar">
          <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest px-3 mb-2 truncate">
            #{activeChannel.name} Settings
          </div>

          <button
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-left transition-all cursor-pointer bg-indigo-500/10 text-indigo-400"
          >
            <Shield className="h-4.5 w-4.5" />
            <span>Permissions</span>
          </button>
        </div>
      </div>

      {/* 2. Right Workspace Content Pane (Primary Background) */}
      <div className="flex-[2] bg-bg-primary relative overflow-y-auto flex justify-start">
        <div className="w-full max-w-[740px] px-6 py-8 md:px-12 md:py-16 pb-24">
          <ChannelPermissionsTab channelId={activeChannel.id} />
        </div>

        {/* Close Button / ESC Helper */}
        <div className="fixed top-8 right-8 hidden md:flex flex-col items-center gap-2">
          <button
            onClick={() => setShowChannelSettings(false)}
            className="p-2.5 bg-bg-secondary border-2 border-border-custom hover:bg-bg-tertiary rounded-full text-text-secondary hover:text-text-primary transition-all cursor-pointer shadow-sm hover:scale-105"
            aria-label="Close Settings"
          >
            <X className="h-5 w-5" />
          </button>
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest select-none">
            ESC
          </span>
        </div>
        
        {/* Mobile Close Button */}
        <button
          onClick={() => setShowChannelSettings(false)}
          className="md:hidden absolute top-4 right-4 p-2 bg-bg-secondary border border-border-custom rounded-full text-text-secondary z-20 cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
