"use client";

import React, { useState, useEffect } from "react";
import { useGuildStore } from "../../../store/guild-store";
import { useRoles } from "../../../services/query/useRoles";
import { useChannelPermissions } from "../../../services/query/useChannelPermissions";
import { useChannels } from "../../../services/query/useChannels";
import { ALL_PERMISSIONS, Permission } from "../../../lib/permissions";
import { Shield, Check, X, Minus } from "lucide-react";

export default function ChannelPermissionsTab({ channelId }: { channelId: string }) {
  const { activeGuildId } = useGuildStore();
  const { roles } = useRoles(activeGuildId || undefined);
  const { channels } = useChannels(activeGuildId || undefined);
  const { permissions, updatePermission, deletePermission } = useChannelPermissions(channelId);

  const channel = channels.find((c) => c.id === channelId);
  let channelTypeStr: "text" | "voice" | "category" | null = null;
  if (channel?.type === 0) channelTypeStr = "text";
  else if (channel?.type === 1) channelTypeStr = "voice";
  else if (channel?.type === 2) channelTypeStr = "category";

  const visiblePermissions = ALL_PERMISSIONS.filter(
    (p) => p.scope === "channel" && channelTypeStr && p.appliesTo?.includes(channelTypeStr)
  );

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  // Auto-select @everyone (default role) initially
  useEffect(() => {
    if (roles.length > 0 && !selectedRoleId) {
      const defaultRole = roles.find((r) => r.is_default);
      if (defaultRole) setSelectedRoleId(defaultRole.id);
      else setSelectedRoleId(roles[0].id);
    }
  }, [roles, selectedRoleId]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const selectedOverrides = permissions.find((p) => p.role_id === selectedRoleId);

  const allowPerms = selectedOverrides ? BigInt(selectedOverrides.allow_permissions) : 0n;
  const denyPerms = selectedOverrides ? BigInt(selectedOverrides.deny_permissions) : 0n;

  const handleToggle = async (bit: bigint, state: "allow" | "deny" | "default") => {
    if (!selectedRoleId) return;

    let newAllow = allowPerms;
    let newDeny = denyPerms;

    // Clear both
    newAllow = newAllow & ~bit;
    newDeny = newDeny & ~bit;

    if (state === "allow") {
      newAllow = newAllow | bit;
    } else if (state === "deny") {
      newDeny = newDeny | bit;
    }

    // If both are 0, we can delete the override to save space, but updating it to 0 is also fine.
    if (newAllow === 0n && newDeny === 0n && state === "default") {
      // Actually we should delete if this role has no other overrides
      // But let's just save it as 0 to be simple, or delete if it's completely empty.
      if (allowPerms === 0n && denyPerms === 0n) {
          // already 0
      } else if (newAllow === 0n && newDeny === 0n) {
         await deletePermission(selectedRoleId);
         return;
      }
    }

    await updatePermission({
      roleId: selectedRoleId,
      allow: newAllow.toString(),
      deny: newDeny.toString(),
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-6 min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h3 className="text-xl font-bold text-text-primary">Channel Permissions</h3>
          <p className="text-xs text-text-muted mt-1">Override default server permissions for this channel.</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
        {/* Roles List */}
        <div className="w-full md:w-48 bg-bg-secondary border border-border-custom rounded-xl p-2 overflow-x-auto md:overflow-y-auto no-scrollbar flex flex-row md:flex-col gap-2 md:gap-1.5 shrink-0">
          {[...roles]
            .sort((a, b) => b.position - a.position)
            .map((r) => {
              const hasOverride = permissions.some((p) => p.role_id === r.id && (BigInt(p.allow_permissions) > 0n || BigInt(p.deny_permissions) > 0n));
              
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRoleId(r.id)}
                  className={`shrink-0 md:w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer ${
                    selectedRoleId === r.id
                      ? "bg-bg-primary text-text-primary border border-border-custom"
                      : "text-text-secondary hover:bg-bg-primary/50 hover:text-text-primary border border-transparent"
                  }`}
                >
                  <span className="truncate">{r.name}</span>
                  {hasOverride && (
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
        </div>

        {/* Permissions Editor */}
        {selectedRole ? (
          <div className="flex-1 overflow-y-auto pr-2 space-y-6">
            <div className="bg-bg-secondary border border-border-custom rounded-xl p-4">
              <h4 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                <Shield className="h-4 w-4 text-indigo-400" />
                Permissions for {selectedRole.name}
              </h4>
              
              <div className="space-y-4 divide-y divide-border-custom/50">
                {visiblePermissions.map((p) => {
                  const isAllowed = (allowPerms & p.bit) === p.bit;
                  const isDenied = (denyPerms & p.bit) === p.bit;
                  
                  return (
                    <div key={p.name} className="pt-4 first:pt-0 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-text-primary">{p.name}</span>
                        <span className="text-[10px] text-text-muted">{p.desc}</span>
                      </div>
                      
                      <div className="flex items-center bg-bg-primary rounded-lg border border-border-custom p-1 shrink-0 w-fit">
                        <button
                          onClick={() => handleToggle(p.bit, "allow")}
                          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                            isAllowed 
                              ? "bg-green-500/20 text-green-400" 
                              : "text-text-muted hover:text-text-primary hover:bg-bg-secondary"
                          }`}
                          title="Allow"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <div className="w-[1px] h-4 bg-border-custom mx-1" />
                        <button
                          onClick={() => handleToggle(p.bit, "default")}
                          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                            !isAllowed && !isDenied
                              ? "bg-bg-tertiary text-text-primary" 
                              : "text-text-muted hover:text-text-primary hover:bg-bg-secondary"
                          }`}
                          title="Default (Inherit)"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <div className="w-[1px] h-4 bg-border-custom mx-1" />
                        <button
                          onClick={() => handleToggle(p.bit, "deny")}
                          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                            isDenied 
                              ? "bg-red-500/20 text-red-400" 
                              : "text-text-muted hover:text-text-primary hover:bg-bg-secondary"
                          }`}
                          title="Deny"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-muted border border-border-custom rounded-xl text-xs italic">
            Select a role to edit its channel permissions
          </div>
        )}
      </div>
    </div>
  );
}
