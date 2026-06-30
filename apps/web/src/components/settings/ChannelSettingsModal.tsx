"use client";

import React from "react";
import { useUIStore } from "../../store/ui-store";
import { useChannels } from "../../services/query/useChannels";
import { Shield, X, Settings } from "lucide-react";
import ChannelPermissionsTab from "./tabs/ChannelPermissionsTab";
import ChannelOverviewTab from "./tabs/ChannelOverviewTab";
import { useGuildStore } from "../../store/guild-store";

export default function ChannelSettingsModal() {
  const { showChannelSettings, setShowChannelSettings, activeChannelSettingsId } = useUIStore();
  const [activeTab, setActiveTab] = React.useState("overview");

  const { activeGuildId } = useGuildStore();
  const { channels } = useChannels(activeGuildId || undefined);

  const activeChannel = channels.find((c) => c.id === activeChannelSettingsId);

  if (!showChannelSettings || !activeChannel) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 md:p-4 font-sans select-none animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl h-full md:h-[80vh] bg-bg-secondary border-0 md:border border-border-custom md:rounded-md overflow-hidden shadow-lg flex flex-col md:flex-row relative"
        role="dialog"
        aria-label="Channel Settings"
      >
        {/* 1. Left Sidebar Navigation (Desktop / Tablet view) */}
        <div className="hidden md:flex md:w-52 bg-bg-tertiary border-r border-border-custom flex-col p-3 shrink-0 overflow-y-auto no-scrollbar gap-1 items-stretch">
          <div className="flex flex-col gap-1 shrink-0 w-full">
            <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider px-2 py-1 select-none">
              Channel Settings
            </div>
            <div className="text-xs font-semibold text-text-primary px-2 mb-2 truncate">
              # {activeChannel.name}
            </div>

            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium text-left transition-colors cursor-pointer border ${
                activeTab === "overview"
                  ? "bg-bg-secondary border-border-custom text-text-primary"
                  : "border-transparent text-text-secondary hover:bg-bg-secondary/40 hover:text-text-primary"
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveTab("permissions")}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium text-left transition-colors cursor-pointer border ${
                activeTab === "permissions"
                  ? "bg-bg-secondary border-border-custom text-text-primary"
                  : "border-transparent text-text-secondary hover:bg-bg-secondary/40 hover:text-text-primary"
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Permissions</span>
            </button>
          </div>
        </div>

        {/* 1b. Mobile top header & navigation */}
        <div className="flex md:hidden bg-bg-secondary border-b border-border-custom flex-col p-3 shrink-0 gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-primary truncate">
              # {activeChannel.name} Settings
            </span>
            <button
              onClick={() => setShowChannelSettings(false)}
              className="p-1 bg-bg-tertiary border border-border-custom hover:bg-bg-primary rounded text-text-secondary cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-4 text-xs border-b border-border-custom/30 px-1">
            <button
              onClick={() => setActiveTab("overview")}
              className={`pb-2 font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
                activeTab === "overview"
                  ? "border-indigo-500 text-text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("permissions")}
              className={`pb-2 font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
                activeTab === "permissions"
                  ? "border-indigo-500 text-text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              Permissions
            </button>
          </div>
        </div>

        {/* 2. Right Workspace Content Pane */}
        <div className="flex-1 bg-bg-primary relative flex flex-col min-h-0 h-full overflow-hidden">
          <div className="w-full max-w-[740px] px-4 py-6 md:px-10 md:py-8 flex flex-col min-h-0 h-full">
            {activeTab === "overview" && <ChannelOverviewTab activeChannel={activeChannel} />}
            {activeTab === "permissions" && <ChannelPermissionsTab channelId={activeChannel.id} />}
          </div>

          {/* Close Button inside workspace (Desktop Only) */}
          <button
            onClick={() => setShowChannelSettings(false)}
            className="hidden md:block absolute top-4 right-4 p-1.5 bg-bg-tertiary border border-border-custom hover:bg-bg-secondary rounded text-text-secondary hover:text-text-primary z-20 transition-colors cursor-pointer"
            aria-label="Close Settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
