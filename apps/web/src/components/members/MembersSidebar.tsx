"use client";

import React, { useState } from "react";
import { useGuildStore } from "../../store/guild-store";
import { useMembers } from "../../services/query/useMembers";
import { useRoles } from "../../services/query/useRoles";
import { useGuilds } from "../../services/query/useGuilds";
import { useAuthStore } from "../../store/auth-store";
import { Crown, VolumeX, Shield, Loader2, X } from "lucide-react";
import UserProfilePopover from "../../features/profile/components/UserProfilePopover";
import MemberContextMenu from "./MemberContextMenu";
import { getMediaUrl } from "../../lib/media";

const getRoleColorHex = (colorNum?: number) => {
  if (!colorNum) return "#94a3b8"; // default gray
  return "#" + colorNum.toString(16).padStart(6, "0");
};

interface MembersSidebarProps {
  onClose?: () => void;
}

export default function MembersSidebar({ onClose }: MembersSidebarProps = {}) {
  const { activeGuildId } = useGuildStore();
  const { guilds } = useGuilds();
  const {
    infiniteMembers: members,
    infiniteError,
    infiniteIsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMembers(activeGuildId || undefined);
  const { roles } = useRoles(activeGuildId || undefined);
  const { user } = useAuthStore();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    member: any;
  } | null>(null);

  const currentMember = members.find((m) => m.user_id === user?.id);
  const currentUserRoles = currentMember?.roles || [];

  const observerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observerTarget = observerRef.current;
    if (!observerTarget || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(observerTarget);
    return () => observer.unobserve(observerTarget);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, members.length]);

  const activeGuild = guilds.find((g) => g.id === activeGuildId);

  if (!activeGuildId || !activeGuild) {
    return null;
  }

  // 1. Sort roles by position DESC (excluding default @everyone role)
  const sortedRoles = [...roles]
    .filter((r) => !r.is_default)
    .sort((a, b) => b.position - a.position);

  // 2. Map members to their highest role
  const getMemberHighestRole = (m: any) => {
    const userRoleIds = m.roles || [];
    if (userRoleIds.length === 0) return null;

    // Find the role with the highest position
    let highestRole = null;
    for (const roleId of userRoleIds) {
      const r = roles.find((role) => role.id === roleId && !role.is_default);
      if (r) {
        if (!highestRole || r.position > highestRole.position) {
          highestRole = r;
        }
      }
    }
    return highestRole;
  };

  // Group members
  const groupedMembers: Record<string, any[]> = {};
  const onlineMembers: any[] = []; // No roles
  const offlineMembers: any[] = [];

  // Extendable online status checker (placeholder for websocket connection)
  const isOnline = (userId: string) => {
    return true; // Assume all are online for now
  };

  members.forEach((m) => {
    if (isOnline(m.user_id)) {
      const highestRole = getMemberHighestRole(m);
      if (highestRole) {
        if (!groupedMembers[highestRole.id]) {
          groupedMembers[highestRole.id] = [];
        }
        groupedMembers[highestRole.id].push(m);
      } else {
        onlineMembers.push(m);
      }
    } else {
      offlineMembers.push(m);
    }
  });

  const renderMember = (m: any, roleColor?: string) => {
    const isOwner = m.user_id === activeGuild.owner_id;
    return (
      <UserProfilePopover key={m.user_id} userId={m.user_id} side="left" align="start">
        <div
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({
              x: e.clientX,
              y: e.clientY,
              member: m,
            });
          }}
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-bg-secondary/60 cursor-pointer transition-colors w-full group"
        >
          <div className="relative shrink-0 h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-white text-xs select-none overflow-hidden">
            {m.avatar_key ? (
              <img
                src={getMediaUrl(m.avatar_key)}
                alt={m.username}
                className="w-full h-full object-cover"
              />
            ) : (
              m.username.substring(0, 2).toUpperCase()
            )}
            <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-emerald-500 border-[2px] border-bg-primary rounded-full z-10" />
          </div>

          <div className="flex flex-col min-w-0">
            <span
              style={{ color: roleColor || "inherit" }}
              className="text-xs font-semibold text-text-secondary group-hover:text-text-primary truncate flex items-center gap-1.5"
            >
              <span>{m.nickname || m.display_name || m.username}</span>
              {isOwner && (
                <span title="Server Owner">
                  <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                </span>
              )}
            </span>
            <span className="text-[10px] text-text-muted truncate">@{m.username}</span>
          </div>

          {m.is_muted && <VolumeX className="h-3 w-3 text-red-400 shrink-0 ml-auto" />}
        </div>
      </UserProfilePopover>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-bg-secondary overflow-hidden">
      {onClose && (
        <div className="h-12 border-b border-border-custom px-4 flex items-center justify-between shrink-0 shadow-sm bg-bg-secondary">
          <span className="font-bold text-text-primary text-sm">Server Members</span>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            title="Close Sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
      <div className="flex-1 p-3 space-y-4 overflow-y-auto">
        {/* Group by Roles */}
        {sortedRoles.map((role) => {
          const roleMembers = groupedMembers[role.id] || [];
          if (roleMembers.length === 0) return null;

          const roleColor = getRoleColorHex(role.color);

          return (
            <div key={role.id} className="space-y-1">
              <h3
                style={{ color: roleColor }}
                className="text-xxs font-bold uppercase tracking-wider px-2 flex items-center gap-1.5 select-none"
              >
                <Shield className="h-3 w-3" />
                <span>
                  {role.name} — {roleMembers.length}
                </span>
              </h3>
              <div className="space-y-0.5">
                {roleMembers.map((m) => renderMember(m, roleColor))}
              </div>
            </div>
          );
        })}

        {/* Group "Online" (no roles or default only) */}
        {onlineMembers.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-text-muted text-xxs font-bold uppercase tracking-wider px-2 select-none">
              Online — {onlineMembers.length}
            </h3>
            <div className="space-y-0.5">{onlineMembers.map((m) => renderMember(m))}</div>
          </div>
        )}

        {infiniteError && (
          <div className="text-red-500 text-xs p-2">Error: {(infiniteError as Error).message}</div>
        )}

        {/* Group Offline */}
        {offlineMembers.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-text-muted text-xxs font-bold uppercase tracking-wider px-2 select-none">
              Offline — {offlineMembers.length}
            </h3>
            <div className="space-y-0.5 opacity-50">
              {offlineMembers.map((m) => renderMember(m))}
            </div>
          </div>
        )}

        {/* Infinite Scroll Trigger */}
        {hasNextPage && (
          <div ref={observerRef} className="h-8 flex items-center justify-center py-2">
            {isFetchingNextPage ? (
              <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
            ) : null}
          </div>
        )}

        {members.length === 0 && !infiniteIsLoading && (
          <div className="text-center text-text-muted text-xs py-8">No members in this server</div>
        )}

        {infiniteIsLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
          </div>
        )}
        {contextMenu && (
          <MemberContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            member={contextMenu.member}
            guildId={activeGuildId}
            guildOwnerId={activeGuild.owner_id}
            currentUserId={user?.id || ""}
            currentUserPermissions={activeGuild.permissions}
            currentUserRoles={currentUserRoles}
            allRoles={roles}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    </div>
  );
}
