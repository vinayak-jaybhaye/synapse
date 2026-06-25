"use client";

import React, { useState } from "react";
import { useGuildStore } from "../../../store/guild-store";
import { useMembers } from "../../../services/query/useMembers";
import { useRoles } from "../../../services/query/useRoles";
import { getRoleColorHex } from "../../../lib/utils";
import { Search } from "lucide-react";

export default function MembersTab() {
  const { activeGuildId } = useGuildStore();
  const { members, assignRole, unassignRole } = useMembers(activeGuildId || undefined);
  const { roles } = useRoles(activeGuildId || undefined);

  const [memberSearch, setMemberSearch] = useState("");
  const [activeMemberDropdown, setActiveMemberDropdown] = useState<string | null>(null);

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

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      <div>
        <h3 className="text-xl font-bold text-text-primary">Members Directory</h3>
        <p className="text-xs text-text-muted mt-1">Manage server memberships and role assignments.</p>
      </div>

      {/* Search Member */}
      <div className="relative shrink-0">
        <input
          type="text"
          placeholder="Search members..."
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
          className="w-full bg-bg-secondary border border-border-custom focus:border-indigo-500 rounded-xl pl-9 pr-4 py-2 text-xs text-text-primary outline-none"
        />
        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-text-muted" />
      </div>

      {/* Members listing */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {members
          .filter((m) => m.username.toLowerCase().includes(memberSearch.toLowerCase()))
          .map((m) => (
            <div
              key={m.user_id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-bg-secondary border border-border-custom rounded-xl gap-3 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-indigo-500 rounded-full flex items-center justify-center font-bold text-white text-xs">
                  {m.username.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-text-primary">
                    {m.nickname || m.display_name || m.username}
                  </h4>
                  <p className="text-[10px] text-text-muted">@{m.username}</p>
                </div>
              </div>

              {/* Member Role Pill Badges */}
              <div className="flex flex-wrap items-center gap-1.5 justify-end">
                {roles
                  .filter((r) => !r.is_default && (m.roles || []).includes(r.id))
                  .map((r) => {
                    const hex = getRoleColorHex(r.color);
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
                        <button
                          onClick={() => handleUnassignRole(m.user_id, r.id)}
                          className="hover:bg-red-500/20 hover:text-red-400 rounded-sm w-3 h-3 flex items-center justify-center text-[9px] cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })}

                {/* Plus Add Role dropdown toggle */}
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
                          (r) => !r.is_default && !(m.roles || []).includes(r.id)
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
                        (r) => !r.is_default && !(m.roles || []).includes(r.id)
                      ).length === 0 && (
                        <span className="block px-3 py-1 text-[10px] text-text-muted italic">
                          No roles to add
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
