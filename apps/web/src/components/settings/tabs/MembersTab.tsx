"use client";

import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGuildStore } from "../../../store/guild-store";
import { useMembers, membersKeys } from "../../../services/query/useMembers";
import { useRoles } from "../../../services/query/useRoles";
import { useGuilds } from "../../../services/query/useGuilds";
import { useAuthStore } from "../../../store/auth-store";
import { useGuildPermissions } from "../../../hooks/usePermissions";
import { useBans, bansKeys } from "../../../services/query/useBans";
import { guildsApi } from "../../../services/api/guilds";
import { getRoleColorHex } from "../../../lib/utils";
import { Search, UserMinus, Ban, Volume2, VolumeX, ShieldCheck, ShieldX } from "lucide-react";

export default function MembersTab() {
  const queryClient = useQueryClient();
  const { activeGuildId } = useGuildStore();
  const { guilds } = useGuilds();
  const { user } = useAuthStore();

  const activeGuild = guilds.find((g) => g.id === activeGuildId);
  const { canKickMembers, canBanMembers, canManageRoles } = useGuildPermissions(activeGuild?.permissions);
  const requesterIsOwner = user?.id === activeGuild?.owner_id;

  const { members, assignRole, unassignRole } = useMembers(activeGuildId || undefined);
  const { roles } = useRoles(activeGuildId || undefined);
  const { bans, unbanMember } = useBans(activeGuildId || undefined);

  const [currentSubTab, setCurrentSubTab] = useState<"all" | "muted" | "banned">("all");
  const [memberSearch, setMemberSearch] = useState("");
  const [activeMemberDropdown, setActiveMemberDropdown] = useState<string | null>(null);

  const currentMember = members.find((m) => m.user_id === user?.id);
  const currentUserRoles = currentMember?.roles || [];

  // Compute hierarchies
  const getHighestRolePosition = (roleIds: string[]) => {
    if (roleIds.length === 0) return -1;
    let maxPos = -1;
    for (const rId of roleIds) {
      const r = roles.find((role) => role.id === rId);
      if (r && r.position > maxPos) {
        maxPos = r.position;
      }
    }
    return maxPos;
  };

  const requesterHighestRolePos = getHighestRolePosition(currentUserRoles);

  const canManageTarget = (targetUserId: string, targetRoles: string[]) => {
    if (requesterIsOwner) return true;
    if (targetUserId === activeGuild?.owner_id) return false;
    if (targetUserId === user?.id) return false;
    const targetHighestRolePos = getHighestRolePosition(targetRoles);
    return requesterHighestRolePos > targetHighestRolePos;
  };

  const handleAssignRole = async (userId: string, roleId: string) => {
    try {
      await assignRole({ userId, roleId });
      setActiveMemberDropdown(null);
    } catch (err: any) {
      alert(err.message || "Failed to assign role");
    }
  };

  const handleUnassignRole = async (userId: string, roleId: string) => {
    try {
      await unassignRole({ userId, roleId });
    } catch (err: any) {
      alert(err.message || "Failed to remove role");
    }
  };

  const handleKick = async (targetUserId: string, username: string) => {
    if (confirm(`Are you sure you want to kick @${username}?`)) {
      try {
        await guildsApi.kickMember(activeGuildId!, targetUserId);
        queryClient.invalidateQueries({ queryKey: membersKeys.list(activeGuildId || "") });
      } catch (err: any) {
        alert(err.message || "Failed to kick member");
      }
    }
  };

  const handleBan = async (targetUserId: string, username: string) => {
    const reason = prompt(`Reason for banning @${username} (optional):`);
    if (reason !== null) {
      try {
        await guildsApi.banMember(activeGuildId!, targetUserId, reason || undefined);
        queryClient.invalidateQueries({ queryKey: membersKeys.list(activeGuildId || "") });
        queryClient.invalidateQueries({ queryKey: bansKeys.list(activeGuildId || "") });
      } catch (err: any) {
        alert(err.message || "Failed to ban member");
      }
    }
  };

  const handleUnban = async (targetUserId: string, username: string) => {
    if (confirm(`Are you sure you want to lift the ban for @${username}?`)) {
      try {
        await unbanMember(targetUserId);
        queryClient.invalidateQueries({ queryKey: bansKeys.list(activeGuildId || "") });
      } catch (err: any) {
        alert(err.message || "Failed to unban user");
      }
    }
  };

  const handleMuteToggle = async (targetUserId: string, currentMute: boolean) => {
    try {
      // Direct raw patch to update is_muted status
      const { api } = await import("../../../lib/api");
      await api.patch(`/guilds/${activeGuildId}/members/${targetUserId}`, { is_muted: !currentMute });
      queryClient.invalidateQueries({ queryKey: membersKeys.list(activeGuildId || "") });
    } catch (err: any) {
      alert(err.message || "Failed to update mute status");
    }
  };

  // Muted members filtered from active members list
  const mutedMembers = members.filter((m) => m.is_muted);

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      <div>
        <h3 className="text-xl font-bold text-text-primary font-outfit">Members Directory</h3>
        <p className="text-xs text-text-muted mt-1">Manage server memberships, roles, mutes, and bans.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-custom shrink-0 gap-2 mb-1">
        <button
          onClick={() => setCurrentSubTab("all")}
          className={`px-4 py-2 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
            currentSubTab === "all"
              ? "border-indigo-500 text-text-primary"
              : "border-transparent text-text-muted hover:text-text-primary"
          }`}
        >
          All Members ({members.length})
        </button>
        <button
          onClick={() => setCurrentSubTab("muted")}
          className={`px-4 py-2 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
            currentSubTab === "muted"
              ? "border-indigo-500 text-text-primary"
              : "border-transparent text-text-muted hover:text-text-primary"
          }`}
        >
          Muted Members ({mutedMembers.length})
        </button>
        {(canBanMembers || requesterIsOwner) && (
          <button
            onClick={() => setCurrentSubTab("banned")}
            className={`px-4 py-2 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
              currentSubTab === "banned"
                ? "border-indigo-500 text-text-primary"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            Banned Members ({bans.length})
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative shrink-0">
        <input
          type="text"
          placeholder={
            currentSubTab === "banned"
              ? "Search banned users..."
              : currentSubTab === "muted"
              ? "Search muted members..."
              : "Search members..."
          }
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
          className="w-full bg-bg-secondary border border-border-custom focus:border-indigo-500 rounded-xl pl-9 pr-4 py-2 text-xs text-text-primary outline-none"
        />
        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-text-muted" />
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {/* ALL MEMBERS TAB */}
        {currentSubTab === "all" &&
          members
            .filter((m) => m.username.toLowerCase().includes(memberSearch.toLowerCase()))
            .map((m) => {
              const editable = canManageTarget(m.user_id, m.roles);
              return (
                <div
                  key={m.user_id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-bg-secondary border border-border-custom rounded-xl gap-3 shadow-sm hover:border-border-custom/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-indigo-500 rounded-full flex items-center justify-center font-bold text-white text-xs select-none">
                      {m.username.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                        <span>{m.nickname || m.display_name || m.username}</span>
                        {m.user_id === activeGuild?.owner_id && (
                          <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1 py-0.5 rounded border border-amber-500/20 font-normal scale-90">
                            Owner
                          </span>
                        )}
                      </h4>
                      <p className="text-[10px] text-text-muted">@{m.username}</p>
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    {/* Roles Badges */}
                    <div className="flex flex-wrap gap-1">
                      {roles
                        .filter((r) => !r.is_default && (m.roles || []).includes(r.id))
                        .map((r) => {
                          const hex = getRoleColorHex(r.color);
                          const canRemoveRole =
                            (canManageRoles || requesterIsOwner) &&
                            editable &&
                            (requesterIsOwner || requesterHighestRolePos > r.position);

                          return (
                            <span
                              key={r.id}
                              style={{
                                borderColor: hex + "30",
                                color: hex,
                                backgroundColor: hex + "12",
                              }}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold border rounded-md px-2 py-0.5 select-none leading-none shrink-0"
                            >
                              <span>{r.name}</span>
                              {canRemoveRole && (
                                <button
                                  onClick={() => handleUnassignRole(m.user_id, r.id)}
                                  className="hover:bg-red-500/20 hover:text-red-400 rounded-sm w-3 h-3 flex items-center justify-center text-[9px] cursor-pointer"
                                >
                                  ✕
                                </button>
                              )}
                            </span>
                          );
                        })}
                    </div>

                    {/* Add Role Plus */}
                    {(canManageRoles || requesterIsOwner) && editable && (
                      <div className="relative">
                        <button
                          onClick={() =>
                            setActiveMemberDropdown(
                              activeMemberDropdown === m.user_id ? null : m.user_id
                            )
                          }
                          className="h-6 px-2 border border-border-custom hover:border-text-muted rounded bg-bg-tertiary text-[10px] font-bold text-text-secondary hover:text-text-primary cursor-pointer flex items-center gap-1.5"
                        >
                          <span>+ Add Role</span>
                        </button>

                        {activeMemberDropdown === m.user_id && (
                          <div className="absolute right-0 mt-1.5 w-40 bg-bg-secondary border border-border-custom rounded-lg shadow-xl py-1.5 z-40 max-h-40 overflow-y-auto">
                            {roles
                              .filter(
                                (r) =>
                                  !r.is_default &&
                                  !(m.roles || []).includes(r.id) &&
                                  (requesterIsOwner || requesterHighestRolePos > r.position)
                              )
                              .map((r) => (
                                <button
                                  key={r.id}
                                  onClick={() => handleAssignRole(m.user_id, r.id)}
                                  className="w-full text-left px-3 py-1.5 hover:bg-bg-primary text-xs font-semibold text-text-secondary hover:text-text-primary cursor-pointer truncate"
                                >
                                  {r.name}
                                </button>
                              ))}
                            {roles.filter(
                              (r) =>
                                !r.is_default &&
                                !(m.roles || []).includes(r.id) &&
                                (requesterIsOwner || requesterHighestRolePos > r.position)
                            ).length === 0 && (
                              <span className="block px-3 py-1 text-[10px] text-text-muted italic">
                                No roles to add
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mute, Kick, Ban inline actions */}
                    {m.user_id !== user?.id && m.user_id !== activeGuild?.owner_id && (
                      <div className="flex items-center gap-1 border-l border-border-custom/50 pl-2">
                        {/* Mute button */}
                        {editable && (
                          <button
                            onClick={() => handleMuteToggle(m.user_id, m.is_muted)}
                            className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                              m.is_muted
                                ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                : "text-text-muted hover:bg-bg-tertiary hover:text-text-primary"
                            }`}
                            title={m.is_muted ? "Unmute Server Audio" : "Server Mute Audio"}
                          >
                            {m.is_muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                          </button>
                        )}

                        {/* Kick button */}
                        {(canKickMembers || requesterIsOwner) && editable && (
                          <button
                            onClick={() => handleKick(m.user_id, m.username)}
                            className="p-1.5 text-text-muted hover:bg-red-500/10 hover:text-red-400 rounded-lg cursor-pointer transition-colors"
                            title="Kick Member"
                          >
                            <UserMinus className="h-4 w-4" />
                          </button>
                        )}

                        {/* Ban button */}
                        {(canBanMembers || requesterIsOwner) && editable && (
                          <button
                            onClick={() => handleBan(m.user_id, m.username)}
                            className="p-1.5 text-text-muted hover:bg-red-500/10 hover:text-red-400 rounded-lg cursor-pointer transition-colors"
                            title="Ban Member"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

        {/* MUTED MEMBERS TAB */}
        {currentSubTab === "muted" &&
          mutedMembers
            .filter((m) => m.username.toLowerCase().includes(memberSearch.toLowerCase()))
            .map((m) => {
              const editable = canManageTarget(m.user_id, m.roles);
              return (
                <div
                  key={m.user_id}
                  className="flex items-center justify-between p-3.5 bg-bg-secondary border border-border-custom rounded-xl shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center font-bold text-xs select-none">
                      <VolumeX className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-text-primary">
                        {m.nickname || m.display_name || m.username}
                      </h4>
                      <p className="text-[10px] text-text-muted">@{m.username}</p>
                    </div>
                  </div>

                  {editable && (
                    <button
                      onClick={() => handleMuteToggle(m.user_id, m.is_muted)}
                      className="px-3 py-1.5 bg-bg-tertiary border border-border-custom hover:bg-indigo-600 hover:text-white rounded-lg text-xs font-bold text-text-secondary cursor-pointer transition-all"
                    >
                      Unmute Member
                    </button>
                  )}
                </div>
              );
            })}
        {currentSubTab === "muted" && mutedMembers.length === 0 && (
          <div className="text-center text-text-muted text-xs py-8">No muted members in this server.</div>
        )}

        {/* BANNED MEMBERS TAB */}
        {currentSubTab === "banned" &&
          (canBanMembers || requesterIsOwner) &&
          bans
            .filter((b) => b.username.toLowerCase().includes(memberSearch.toLowerCase()))
            .map((b) => (
              <div
                key={b.user_id}
                className="flex items-center justify-between p-3.5 bg-bg-secondary border border-border-custom rounded-xl shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center font-bold text-xs select-none">
                    <Ban className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-text-primary">
                      {b.display_name || b.username}
                    </h4>
                    <p className="text-[10px] text-text-muted">@{b.username}</p>
                    {b.reason && (
                      <p className="text-[10px] text-red-400/90 mt-1 italic font-medium">
                        Reason: &quot;{b.reason}&quot;
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleUnban(b.user_id, b.username)}
                  className="px-3 py-1.5 bg-bg-tertiary border border-border-custom hover:border-indigo-500 text-indigo-400 hover:text-indigo-300 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Revoke Ban</span>
                </button>
              </div>
            ))}
        {currentSubTab === "banned" && bans.length === 0 && (
          <div className="text-center text-text-muted text-xs py-8">No banned users.</div>
        )}
      </div>
    </div>
  );
}
