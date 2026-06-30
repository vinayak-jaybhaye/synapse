"use client";

import React from "react";
import { useUIStore } from "../../store/ui-store";
import { User, Palette, Accessibility, X } from "lucide-react";
import ProfileTab from "./tabs/ProfileTab";
import AppearanceTab from "./tabs/AppearanceTab";
import AccessibilityTab from "./tabs/AccessibilityTab";

export default function UserSettingsModal() {
  const { showSettings, setShowSettings } = useUIStore();
  const [settingsTab, setSettingsTab] = React.useState("profile");

  if (!showSettings) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 md:p-4 font-sans select-none">
      <div
        className="w-full max-w-4xl h-full md:h-[80vh] bg-bg-secondary border-0 md:border border-border-custom md:rounded-md overflow-hidden shadow-lg flex flex-col md:flex-row relative"
        role="dialog"
        aria-label="Settings"
      >
        {/* Mobile top header & close button */}
        <div className="flex md:hidden bg-bg-secondary border-b border-border-custom items-center justify-between p-3 shrink-0">
          <span className="text-xs font-bold text-text-primary">User Settings</span>
          <button
            onClick={() => setShowSettings(false)}
            className="p-1 bg-bg-tertiary border border-border-custom hover:bg-bg-primary rounded text-text-secondary cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 1. Sidebar Navigation Column */}
        <div className="w-full md:w-52 bg-bg-tertiary border-b md:border-b-0 md:border-r border-border-custom flex md:flex-col p-2 shrink-0 overflow-x-auto md:overflow-y-auto no-scrollbar gap-1 items-center md:items-stretch">
          <div className="flex md:flex-col gap-1 shrink-0 w-full">
            <div className="hidden md:block text-[10px] text-text-muted font-bold uppercase tracking-wider px-2.5 py-2 select-none">
              User Settings
            </div>

            <button
              onClick={() => setSettingsTab("profile")}
              className={`shrink-0 md:w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium text-left transition-colors cursor-pointer border ${
                settingsTab === "profile"
                  ? "bg-bg-secondary border-border-custom text-text-primary"
                  : "border-transparent text-text-secondary hover:bg-bg-secondary/40 hover:text-text-primary"
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>Profile</span>
            </button>

            <button
              onClick={() => setSettingsTab("appearance")}
              className={`shrink-0 md:w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium text-left transition-colors cursor-pointer border ${
                settingsTab === "appearance"
                  ? "bg-bg-secondary border-border-custom text-text-primary"
                  : "border-transparent text-text-secondary hover:bg-bg-secondary/40 hover:text-text-primary"
              }`}
            >
              <Palette className="h-3.5 w-3.5" />
              <span>Appearance</span>
            </button>

            <button
              onClick={() => setSettingsTab("accessibility")}
              className={`shrink-0 md:w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium text-left transition-colors cursor-pointer border ${
                settingsTab === "accessibility"
                  ? "bg-bg-secondary border-border-custom text-text-primary"
                  : "border-transparent text-text-secondary hover:bg-bg-secondary/40 hover:text-text-primary"
              }`}
            >
              <Accessibility className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Accessibility</span>
              <span className="sm:hidden">Access</span>
            </button>
          </div>
        </div>

        {/* 2. Right Workspace Content Pane */}
        <div className="flex-1 bg-bg-primary p-4 md:p-6 md:pr-14 overflow-y-auto flex flex-col relative">
          {/* Close Button inside workspace (Desktop Only) */}
          <button
            onClick={() => setShowSettings(false)}
            className="hidden md:block absolute top-4 right-4 p-1 bg-bg-tertiary border border-border-custom hover:bg-bg-secondary rounded text-text-secondary hover:text-text-primary z-20 transition-colors cursor-pointer"
            aria-label="Close Settings"
          >
            <X className="h-4 w-4" />
          </button>

          {settingsTab === "profile" && <ProfileTab />}
          {settingsTab === "appearance" && <AppearanceTab />}
          {settingsTab === "accessibility" && <AccessibilityTab />}
        </div>
      </div>
    </div>
  );
}
