"use client";

import React from "react";
import { useUIStore } from "../../store/ui-store";
import { useGuildStore } from "../../store/guild-store";
import { useGuilds } from "../../services/query/useGuilds";
import { useGuildPermissions } from "../../hooks/usePermissions";
import { Shield, Users, Settings, FileText, Link2, X } from "lucide-react";

import RolesTab from "./tabs/RolesTab";
import MembersTab from "./tabs/MembersTab";
import OverviewTab from "./tabs/OverviewTab";
import AuditLogTab from "./tabs/AuditLogTab";
import InvitesTab from "./tabs/InvitesTab";

export default function GuildSettingsModal() {
  const { showGuildSettings, setShowGuildSettings, guildSettingsTab, setGuildSettingsTab } =
    useUIStore();
  const { activeGuildId } = useGuildStore();
  const { guilds } = useGuilds();

  const activeGuild = guilds.find((g) => g.id === activeGuildId);
  const {
    canManageGuild,
    canManageRoles,
    canKickMembers,
    canBanMembers,
    canCreateInstantInvite,
    canViewAuditLog,
  } = useGuildPermissions(activeGuild?.permissions);

  if (!showGuildSettings || !activeGuild) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 md:p-4 font-sans select-none">
      <div
        className="w-full max-w-4xl h-full md:h-[80vh] bg-bg-secondary border-0 md:border border-border-custom md:rounded-md overflow-hidden shadow-lg flex flex-col md:flex-row relative"
        role="dialog"
        aria-label="Settings"
      >
        {/* Mobile top header & close button */}
        <div className="flex md:hidden bg-bg-secondary border-b border-border-custom items-center justify-between p-3 shrink-0">
          <span className="text-xs font-bold text-text-primary">Server Settings</span>
          <button
            onClick={() => setShowGuildSettings(false)}
            className="p-1 bg-bg-tertiary border border-border-custom hover:bg-bg-primary rounded text-text-secondary cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 1. Sidebar Navigation Column */}
        <div className="w-full md:w-52 bg-bg-tertiary border-b md:border-b-0 md:border-r border-border-custom flex md:flex-col p-2 shrink-0 overflow-x-auto md:overflow-y-auto no-scrollbar gap-1 items-center md:items-stretch">
          <div className="flex md:flex-col gap-1 shrink-0 w-full">
            <div className="hidden md:block text-[10px] text-text-muted font-bold uppercase tracking-wider px-2.5 py-2 select-none">
              Server Settings
            </div>

            {canManageGuild && (
              <button
                onClick={() => setGuildSettingsTab("overview")}
                className={`shrink-0 md:w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium text-left transition-colors cursor-pointer border ${
                  guildSettingsTab === "overview"
                    ? "bg-bg-secondary border-border-custom text-text-primary"
                    : "border-transparent text-text-secondary hover:bg-bg-secondary/40 hover:text-text-primary"
                }`}
              >
                <Settings className="h-3.5 w-3.5" />
                <span>Overview</span>
              </button>
            )}

            {canManageRoles && (
              <button
                onClick={() => setGuildSettingsTab("roles")}
                className={`shrink-0 md:w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium text-left transition-colors cursor-pointer border ${
                  guildSettingsTab === "roles"
                    ? "bg-bg-secondary border-border-custom text-text-primary"
                    : "border-transparent text-text-secondary hover:bg-bg-secondary/40 hover:text-text-primary"
                }`}
              >
                <Shield className="h-3.5 w-3.5" />
                <span>Roles</span>
              </button>
            )}

            {(canKickMembers || canBanMembers || canManageRoles) && (
              <button
                onClick={() => setGuildSettingsTab("members")}
                className={`shrink-0 md:w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium text-left transition-colors cursor-pointer border ${
                  guildSettingsTab === "members"
                    ? "bg-bg-secondary border-border-custom text-text-primary"
                    : "border-transparent text-text-secondary hover:bg-bg-secondary/40 hover:text-text-primary"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Members</span>
              </button>
            )}

            {(canManageGuild || canCreateInstantInvite) && (
              <button
                onClick={() => setGuildSettingsTab("invites")}
                className={`shrink-0 md:w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium text-left transition-colors cursor-pointer border ${
                  guildSettingsTab === "invites"
                    ? "bg-bg-secondary border-border-custom text-text-primary"
                    : "border-transparent text-text-secondary hover:bg-bg-secondary/40 hover:text-text-primary"
                }`}
              >
                <Link2 className="h-3.5 w-3.5 text-indigo-400" />
                <span>Invites</span>
              </button>
            )}

            {canViewAuditLog && (
              <button
                onClick={() => setGuildSettingsTab("audit_logs")}
                className={`shrink-0 md:w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium text-left transition-colors cursor-pointer border ${
                  guildSettingsTab === "audit_logs"
                    ? "bg-bg-secondary border-border-custom text-text-primary"
                    : "border-transparent text-text-secondary hover:bg-bg-secondary/40 hover:text-text-primary"
                }`}
              >
                <FileText className="h-3.5 w-3.5 text-indigo-400" />
                <span>Audit Log</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Right Workspace Content Pane */}
        <div className="flex-1 bg-bg-primary p-4 md:p-6 md:pr-14 overflow-y-auto flex flex-col relative">
          {/* Close Button inside workspace (Desktop Only) */}
          <button
            onClick={() => setShowGuildSettings(false)}
            className="hidden md:block absolute top-4 right-4 p-1 bg-bg-tertiary border border-border-custom hover:bg-bg-secondary rounded text-text-secondary hover:text-text-primary z-20 transition-colors cursor-pointer"
            aria-label="Close Settings"
          >
            <X className="h-4 w-4" />
          </button>

          {guildSettingsTab === "overview" && <OverviewTab activeGuild={activeGuild} />}
          {guildSettingsTab === "roles" && <RolesTab />}
          {guildSettingsTab === "members" && <MembersTab />}
          {guildSettingsTab === "invites" && <InvitesTab />}
          {guildSettingsTab === "audit_logs" && <AuditLogTab />}
        </div>
      </div>
    </div>
  );
}
