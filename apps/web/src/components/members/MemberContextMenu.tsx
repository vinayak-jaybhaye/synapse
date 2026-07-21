"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Volume2,
  VolumeX,
  Shield,
  UserMinus,
  Ban,
  Edit2,
  Check,
  X,
  ShieldAlert,
} from "lucide-react";
import { guildsApi } from "../../services/api/guilds";
import { rolesApi } from "../../services/api/roles";
import { membersKeys } from "../../services/query/useMembers";
import { normalizeError } from "../../lib/api";
import { useUIStore } from "../../store/ui-store";
import { Member, Role } from "../../types";

interface MemberContextMenuProps {
  x: number;
  y: number;
  member: Member;
  guildId: string;
  guildOwnerId: string;
  currentUserId: string;
  currentUserPermissions?: string;
  currentUserRoles: string[];
  allRoles: Role[];
  onClose: () => void;
}

export default function MemberContextMenu({
  x,
  y,
  member,
  guildId,
  guildOwnerId,
  currentUserId,
  currentUserPermissions,
  currentUserRoles,
  allRoles,
  onClose,
}: MemberContextMenuProps) {
  const queryClient = useQueryClient();
  const menuRef = useRef<HTMLDivElement>(null);
  const [showNicknameInput, setShowNicknameInput] = useState(false);
  const [nickname, setNickname] = useState(member.nickname || "");
  const [showRolesSubmenu, setShowRolesSubmenu] = useState(false);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [onClose]);

  // Compute hierarchies
  const getHighestRolePosition = (roleIds: string[]) => {
    if (roleIds.length === 0) return -1;
    let maxPos = -1;
    for (const rId of roleIds) {
      const r = allRoles.find((role) => role.id === rId);
      if (r && r.position > maxPos) {
        maxPos = r.position;
      }
    }
    return maxPos;
  };

  const isOwner = (userId: string) => userId === guildOwnerId;

  const requesterIsOwner = isOwner(currentUserId);
  const targetIsOwner = isOwner(member.user_id);

  const requesterHighestRolePos = getHighestRolePosition(currentUserRoles);
  const targetHighestRolePos = getHighestRolePosition(member.roles || []);

  // Can the current user manage the target user?
  // Requester must be owner, OR (requester highest role > target highest role AND target is not owner)
  const canManageTarget =
    requesterIsOwner ||
    (requesterHighestRolePos > targetHighestRolePos &&
      !targetIsOwner &&
      currentUserId !== member.user_id);

  // Parse permissions
  const BigIntPerms = currentUserPermissions ? BigInt(currentUserPermissions) : 0n;
  const ADMINISTRATOR = 1n << 3n;
  const KICK_MEMBERS = 1n << 1n;
  const BAN_MEMBERS = 1n << 2n;
  const MANAGE_ROLES = 1n << 28n;
  const MANAGE_NICKNAMES = 1n << 27n;
  const CHANGE_NICKNAME = 1n << 26n;

  const hasPerm = (flag: bigint) => {
    if ((BigIntPerms & ADMINISTRATOR) === ADMINISTRATOR) return true;
    return (BigIntPerms & flag) === flag;
  };

  const hasKickPerm = hasPerm(KICK_MEMBERS);
  const hasBanPerm = hasPerm(BAN_MEMBERS);
  const hasManageRolesPerm = hasPerm(MANAGE_ROLES);
  const hasManageNicknamesPerm = hasPerm(MANAGE_NICKNAMES);
  const hasChangeNicknamePerm = hasPerm(CHANGE_NICKNAME);

  const isMe = currentUserId === member.user_id;
  const isTargetOwner = member.user_id === guildOwnerId;

  const canKick = !isMe && !isTargetOwner && ((hasKickPerm && canManageTarget) || requesterIsOwner);
  const canBan = !isMe && !isTargetOwner && ((hasBanPerm && canManageTarget) || requesterIsOwner);
  const canManageRoles =
    !isTargetOwner && ((hasManageRolesPerm && canManageTarget) || requesterIsOwner);

  const getDisableReason = () => {
    if (isMe) return "Self Target";
    if (isTargetOwner) return "Owner Guard";
    return "Hierarchy Guard";
  };

  // Nickname permission checking
  const canChangeNickname =
    currentUserId === member.user_id
      ? hasChangeNicknamePerm || hasManageNicknamesPerm || requesterIsOwner
      : (hasManageNicknamesPerm && canManageTarget) || requesterIsOwner;

  // Roles that are lower than the requester's highest role (or all roles if owner)
  const assignableRoles = allRoles.filter(
    (role) => !role.is_default && (requesterIsOwner || requesterHighestRolePos > role.position),
  );

  const handleMuteToggle = async () => {
    try {
      // Backend PatchGuildMember mutates mute status via guilds service (requires MUTE_MEMBERS)
      const isMuted = !member.is_muted;
      await guildsApi.patchGuildMember(guildId, member.user_id, {
        nickname: member.nickname || undefined,
      } as Record<string, unknown>);

      // Wait, patchGuildMember in service.go:
      // if req.IsMuted != nil { ... }
      // But the api definition in guilds.ts currently only takes nickname. Let's send raw payload
      await apiPatchGuildMemberMute(guildId, member.user_id, isMuted);

      queryClient.invalidateQueries({ queryKey: membersKeys.list(guildId) });
      onClose();
    } catch (err) {
      useUIStore.getState().showToast(normalizeError(err).message, "error");
    }
  };

  // Raw helper to patch is_muted since client wrapper doesn't expose it
  const apiPatchGuildMemberMute = async (gId: string, uId: string, mute: boolean) => {
    const { api } = await import("../../lib/api");
    await api.patch(`/guilds/${gId}/members/${uId}`, { is_muted: mute });
  };

  const handleSaveNickname = async () => {
    try {
      await guildsApi.patchGuildMember(guildId, member.user_id, {
        nickname: nickname.trim() === "" ? "" : nickname,
      });
      queryClient.invalidateQueries({ queryKey: membersKeys.list(guildId) });
      onClose();
    } catch (err) {
      useUIStore.getState().showToast(normalizeError(err).message, "error");
    }
  };

  const handleKick = async () => {
    if (confirm(`Are you sure you want to kick @${member.username}?`)) {
      try {
        await guildsApi.kickMember(guildId, member.user_id);
        queryClient.invalidateQueries({ queryKey: membersKeys.list(guildId) });
        onClose();
      } catch (err) {
        useUIStore.getState().showToast(normalizeError(err).message, "error");
      }
    }
  };

  const handleBan = async () => {
    const reason = prompt(`Reason for banning @${member.username} (optional):`);
    if (reason !== null) {
      try {
        await guildsApi.banMember(guildId, member.user_id, reason || undefined);
        queryClient.invalidateQueries({ queryKey: membersKeys.list(guildId) });
        onClose();
      } catch (err) {
        useUIStore.getState().showToast(normalizeError(err).message, "error");
      }
    }
  };

  const handleToggleRole = async (roleId: string, isAssigned: boolean) => {
    try {
      if (isAssigned) {
        await rolesApi.unassignRole(guildId, member.user_id, roleId);
      } else {
        await rolesApi.assignRole(guildId, member.user_id, roleId);
      }
      queryClient.invalidateQueries({ queryKey: membersKeys.list(guildId) });
    } catch (err) {
      useUIStore.getState().showToast(normalizeError(err).message, "error");
    }
  };

  // Adjust menu coordinates so it doesn't overflow screen limits
  const screenWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
  const screenHeight = typeof window !== "undefined" ? window.innerHeight : 800;
  const menuWidth = 220;
  const menuHeight = 280;

  const adjustedX = x + menuWidth > screenWidth ? screenWidth - menuWidth - 10 : x;
  const adjustedY = y + menuHeight > screenHeight ? screenHeight - menuHeight - 10 : y;

  return (
    <div
      ref={menuRef}
      style={{ top: adjustedY, left: adjustedX }}
      className="fixed z-50 w-56 bg-bg-secondary/95 border border-border-custom rounded-lg shadow-xl py-1.5 text-text-primary backdrop-blur-md select-none outline-none animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Header Profile Summary */}
      <div className="px-3 py-2 border-b border-border-custom/50 flex flex-col mb-1 select-none pointer-events-none">
        <span className="text-xs font-bold text-text-primary truncate">
          {member.nickname || member.display_name || member.username}
        </span>
        <span className="text-[10px] text-text-muted truncate">@{member.username}</span>
      </div>

      {/* Nickname Input inline */}
      {showNicknameInput ? (
        <div className="px-2 py-1.5 flex items-center gap-1.5">
          <input
            type="text"
            className="flex-1 min-w-0 bg-bg-tertiary border border-border-custom rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-indigo-500"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="No nickname"
            maxLength={64}
            autoFocus
          />
          <button
            onClick={handleSaveNickname}
            className="p-1 hover:bg-emerald-500/20 text-emerald-400 rounded shrink-0 cursor-pointer"
            title="Save"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setShowNicknameInput(false)}
            className="p-1 hover:bg-red-500/20 text-red-400 rounded shrink-0 cursor-pointer"
            title="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            if (canChangeNickname) setShowNicknameInput(true);
          }}
          disabled={!canChangeNickname}
          className="w-full px-3 py-1.5 flex items-center gap-2 text-xs text-left hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed group relative"
        >
          <Edit2 className="h-3.5 w-3.5" />
          <span>Change Nickname</span>
          {!canChangeNickname && (
            <span className="absolute right-3 hidden group-hover:block text-[10px] text-red-400">
              <ShieldAlert className="h-3 w-3" />
            </span>
          )}
        </button>
      )}

      {/* Mute toggle */}
      <button
        onClick={handleMuteToggle}
        className="w-full px-3 py-1.5 flex items-center gap-2 text-xs text-left hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer"
      >
        {member.is_muted ? (
          <>
            <Volume2 className="h-3.5 w-3.5" />
            <span>Unmute Member</span>
          </>
        ) : (
          <>
            <VolumeX className="h-3.5 w-3.5" />
            <span>Mute Member</span>
          </>
        )}
      </button>

      {/* Manage Roles Dropdown Trigger */}
      <div
        className="relative"
        onMouseEnter={() => setShowRolesSubmenu(true)}
        onMouseLeave={() => setShowRolesSubmenu(false)}
      >
        <button
          disabled={!canManageRoles || assignableRoles.length === 0}
          className="w-full px-3 py-1.5 flex items-center justify-between text-xs hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed group"
        >
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5" />
            <span>Roles</span>
          </div>
          <span className="text-[10px] text-text-muted group-hover:text-white">▶</span>
        </button>

        {/* Roles Submenu */}
        {showRolesSubmenu && assignableRoles.length > 0 && (
          <div className="absolute left-full top-0 ml-1 w-48 bg-bg-secondary/95 border border-border-custom rounded-lg shadow-xl py-1 text-text-primary backdrop-blur-md z-50">
            <div className="px-2 py-1 border-b border-border-custom/50 text-[10px] text-text-muted font-semibold uppercase tracking-wider">
              Assign Roles
            </div>
            <div className="max-h-48 overflow-y-auto py-1">
              {assignableRoles.map((role) => {
                const isAssigned = (member.roles || []).includes(role.id);
                return (
                  <label
                    key={role.id}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-bg-tertiary cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      onChange={() => handleToggleRole(role.id, isAssigned)}
                      className="rounded border-border-custom text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                    />
                    <span
                      style={{
                        color: role.color
                          ? "#" + role.color.toString(16).padStart(6, "0")
                          : undefined,
                      }}
                    >
                      {role.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border-custom/50 my-1" />

      {/* Kick Action */}
      <button
        onClick={handleKick}
        disabled={!canKick}
        className="w-full px-3 py-1.5 flex items-center justify-between text-xs text-red-400 hover:bg-red-600 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed group relative"
      >
        <div className="flex items-center gap-2">
          <UserMinus className="h-3.5 w-3.5" />
          <span>Kick Member</span>
        </div>
        {!canKick && (
          <span className="absolute right-3 hidden group-hover:block text-[9px] text-red-400 select-none bg-red-950/20 px-1 py-0.5 rounded border border-red-500/20">
            {getDisableReason()}
          </span>
        )}
      </button>

      {/* Ban Action */}
      <button
        onClick={handleBan}
        disabled={!canBan}
        className="w-full px-3 py-1.5 flex items-center justify-between text-xs text-red-400 hover:bg-red-600 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed group relative"
      >
        <div className="flex items-center gap-2">
          <Ban className="h-3.5 w-3.5" />
          <span>Ban Member</span>
        </div>
        {!canBan && (
          <span className="absolute right-3 hidden group-hover:block text-[9px] text-red-400 select-none bg-red-950/20 px-1 py-0.5 rounded border border-red-500/20">
            {getDisableReason()}
          </span>
        )}
      </button>
    </div>
  );
}
