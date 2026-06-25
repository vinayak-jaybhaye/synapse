"use client";

import React from "react";
import { useUIStore } from "../../store/ui-store";
import { useGuildStore } from "../../store/guild-store";
import { useGuilds } from "../../services/query/useGuilds";
import {
    User,
    Palette,
    Accessibility,
    Shield,
    Users,
    X,
} from "lucide-react";

import ProfileTab from "./tabs/ProfileTab";
import AppearanceTab from "./tabs/AppearanceTab";
import AccessibilityTab from "./tabs/AccessibilityTab";

export default function UserSettingsModal() {
    const { showSettings, setShowSettings, settingsTab, setSettingsTab } = useUIStore();

    if (!showSettings) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans select-none animate-fadeIn">
            <div
                className="w-full max-w-4xl h-full md:h-[85vh] bg-bg-secondary border-0 md:border border-border-custom md:rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row relative"
                role="dialog"
                aria-label="Settings"
            >
                {/* Close Button */}
                <button
                    onClick={() => setShowSettings(false)}
                    className="absolute top-4 right-4 p-1.5 bg-bg-tertiary border border-border-custom hover:bg-bg-primary rounded-full text-text-secondary hover:text-text-primary z-20 transition-colors cursor-pointer"
                    aria-label="Close Settings"
                >
                    <X className="h-4.5 w-4.5" />
                </button>

                {/* 1. Sidebar Navigation Column */}
                <div className="w-full md:w-60 bg-bg-tertiary border-b md:border-b-0 md:border-r border-border-custom flex md:flex-col p-2 md:p-4 shrink-0 overflow-x-auto md:overflow-y-auto no-scrollbar gap-2 md:gap-4 items-center md:items-stretch">
                    <div className="flex md:flex-col gap-2 md:gap-1 shrink-0">
                        <div className="hidden md:block text-[10px] text-text-muted font-bold uppercase tracking-wider px-2 py-1 select-none">
                            User Settings
                        </div>

                        <button
                            onClick={() => setSettingsTab("profile")}
                            className={`shrink-0 md:w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${settingsTab === "profile"
                                    ? "bg-bg-secondary text-text-primary"
                                    : "text-text-secondary hover:bg-bg-secondary/40 hover:text-text-primary"
                                }`}
                        >
                            <User className="h-4 w-4" />
                            <span>Profile</span>
                        </button>

                        <button
                            onClick={() => setSettingsTab("appearance")}
                            className={`shrink-0 md:w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${settingsTab === "appearance"
                                    ? "bg-bg-secondary text-text-primary"
                                    : "text-text-secondary hover:bg-bg-secondary/40 hover:text-text-primary"
                                }`}
                        >
                            <Palette className="h-4 w-4" />
                            <span>Appearance</span>
                        </button>

                        <button
                            onClick={() => setSettingsTab("accessibility")}
                            className={`shrink-0 md:w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${settingsTab === "accessibility"
                                    ? "bg-bg-secondary text-text-primary"
                                    : "text-text-secondary hover:bg-bg-secondary/40 hover:text-text-primary"
                                }`}
                        >
                            <Accessibility className="h-4 w-4" />
                            <span className="hidden sm:inline">Accessibility</span>
                            <span className="sm:hidden">Access</span>
                        </button>
                    </div>
                </div>

                {/* 2. Right Workspace Content Pane */}
                <div className="flex-1 bg-bg-primary p-4 md:p-6 overflow-y-auto flex flex-col">
                    {settingsTab === "profile" && <ProfileTab />}
                    {settingsTab === "appearance" && <AppearanceTab />}
                    {settingsTab === "accessibility" && <AccessibilityTab />}
                </div>
            </div>
        </div>
    );
}
