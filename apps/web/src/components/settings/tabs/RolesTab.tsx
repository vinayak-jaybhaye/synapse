"use client";

import React, { useState, useEffect } from "react";
import { useGuildStore } from "../../../store/guild-store";
import { useRoles } from "../../../services/query/useRoles";
import { ALL_PERMISSIONS, togglePermission as togglePermBit } from "../../../lib/permissions";
import { getRoleColorHex } from "../../../lib/utils";
import { normalizeError } from "../../../lib/api";
import { useUIStore } from "../../../store/ui-store";
import { Plus, Trash2 } from "lucide-react";

const PRESET_COLORS = [
  { value: 0, label: "Default", hex: "#94a3b8" },
  { value: 3066993, label: "Green", hex: "#2ecc71" },
  { value: 3447003, label: "Blue", hex: "#3498db" },
  { value: 10181046, label: "Purple", hex: "#9b59b6" },
  { value: 15277667, label: "Pink", hex: "#e91e63" },
  { value: 15844367, label: "Yellow", hex: "#f1c40f" },
  { value: 15105570, label: "Orange", hex: "#e67e22" },
  { value: 15158332, label: "Red", hex: "#e74c3c" },
  { value: 1752220, label: "Teal", hex: "#1abc9c" },
];

export default function RolesTab() {
  const { activeGuildId } = useGuildStore();
  const { roles, createRole, updateRole, deleteRole } = useRoles(activeGuildId || undefined);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [editRoleName, setEditRoleName] = useState("");
  const [editRoleColor, setEditRoleColor] = useState(0);
  const [editRoleHoisted, setEditRoleHoisted] = useState(false);
  const [editRolePerms, setEditRolePerms] = useState<bigint>(0n);

  // Set default role selection
  useEffect(() => {
    if (roles.length > 0 && !selectedRoleId) {
      const defaultRole = roles.find((r) => r.is_default);
      if (defaultRole) selectRoleForEditing(defaultRole);
    }
  }, [roles, selectedRoleId]);

  const selectRoleForEditing = (role: any) => {
    setSelectedRoleId(role.id);
    setEditRoleName(role.name);
    setEditRoleColor(role.color || 0);
    setEditRoleHoisted(role.is_hoisted || false);
    setEditRolePerms(BigInt(role.permissions));
  };

  const handleCreateRole = async () => {
    if (!activeGuildId) return;
    try {
      const newRole = await createRole({
        name: "New Role",
        permissions: "0",
        color: 0,
        is_hoisted: false,
      });
      selectRoleForEditing(newRole);
    } catch (err: unknown) {
      useUIStore.getState().showToast(normalizeError(err).message, "error");
    }
  };

  const handleSaveRole = async () => {
    if (!activeGuildId || !selectedRoleId) return;
    try {
      await updateRole({
        roleId: selectedRoleId,
        updates: {
          name: editRoleName,
          color: editRoleColor,
          is_hoisted: editRoleHoisted,
          permissions: editRolePerms.toString(),
        },
      });
      useUIStore.getState().showToast("Role saved successfully!", "success");
    } catch (err: unknown) {
      useUIStore.getState().showToast(normalizeError(err).message, "error");
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!activeGuildId) return;
    if (!confirm("Are you sure you want to delete this role?")) return;
    try {
      await deleteRole(roleId);
      if (selectedRoleId === roleId) {
        setSelectedRoleId(null);
      }
    } catch (err: unknown) {
      useUIStore.getState().showToast(normalizeError(err).message, "error");
    }
  };

  const togglePermission = (bit: bigint) => {
    setEditRolePerms((prev) => togglePermBit(prev, bit));
  };

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      <div className="flex items-center justify-between shrink-0 border-b border-border-custom pb-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Roles Settings</h3>
          <p className="text-[11px] text-text-muted mt-0.5">Manage server permissions.</p>
        </div>
        <button
          onClick={handleCreateRole}
          className="bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1.5 rounded text-xs text-white font-semibold flex items-center gap-1 cursor-pointer transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Create Role</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
        {/* Roles Side list Panel */}
        <div className="w-full md:w-44 bg-bg-secondary rounded p-1.5 overflow-x-auto md:overflow-y-auto no-scrollbar flex flex-row md:flex-col gap-1 shrink-0">
          {[...roles]
            .sort((a, b) => b.position - a.position)
            .map((r) => (
              <button
                key={r.id}
                onClick={() => selectRoleForEditing(r)}
                className={`shrink-0 md:w-full flex items-center justify-between px-2 py-1.5 rounded text-xs font-medium text-left group transition-colors cursor-pointer border ${
                  selectedRoleId === r.id
                    ? "bg-bg-secondary border-border-custom text-text-primary"
                    : "border-transparent text-text-secondary hover:bg-bg-secondary/40 hover:text-text-primary"
                }`}
              >
                <span className="truncate">{r.name}</span>
                {!r.is_default && (
                  <Trash2
                    className="h-3.5 w-3.5 text-text-muted hover:text-red-400 shrink-0 hidden group-hover:block ml-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRole(r.id);
                    }}
                  />
                )}
              </button>
            ))}
        </div>

        {/* Role configuration editing details */}
        {selectedRoleId ? (
          <div className="flex-1 bg-bg-secondary rounded p-3 overflow-y-auto space-y-3.5">
            {/* Role name */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                Role Name
              </label>
              <input
                type="text"
                value={editRoleName}
                onChange={(e) => setEditRoleName(e.target.value)}
                className="bg-bg-tertiary border border-border-custom rounded px-2.5 py-1.5 text-text-primary text-xs focus:outline-none focus:border-indigo-500 w-full transition-colors"
              />
            </div>

            {/* Role Color Picker */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                Role Color
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setEditRoleColor(c.value)}
                    style={{ backgroundColor: c.hex }}
                    className={`h-5 w-5 rounded border cursor-pointer relative transition-transform ${
                      editRoleColor === c.value
                        ? "border-text-primary ring-1 ring-indigo-500 scale-105"
                        : "border-border-custom/50 hover:scale-105"
                    }`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            {/* Role Settings Checkboxes */}
            <div className="flex flex-col gap-1.5 pt-2">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                Display Settings
              </label>
              <div className="rounded border border-border-custom bg-bg-tertiary overflow-hidden">
                <div className="flex items-center justify-between p-2.5 gap-4">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs font-semibold text-text-primary truncate">
                      Display role members separately from online members
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editRoleHoisted}
                    onChange={(e) => setEditRoleHoisted(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border-custom text-indigo-600 focus:ring-indigo-500 mt-0.5 shrink-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Role Permissions Checkboxes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                Role Permissions
              </label>
              <div className="rounded divide-y divide-border-custom bg-bg-tertiary overflow-hidden">
                {ALL_PERMISSIONS.map((p) => {
                  const isEnabled = (editRolePerms & p.bit) === p.bit;
                  return (
                    <div key={p.name} className="flex items-start justify-between p-2.5 gap-4">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-xs font-semibold text-text-primary truncate">
                          {p.name}
                        </span>
                        <span className="text-[10px] text-text-muted leading-tight">{p.desc}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => togglePermission(p.bit)}
                        className="h-3.5 w-3.5 rounded border-border-custom text-indigo-600 focus:ring-indigo-500 mt-0.5 shrink-0 cursor-pointer"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-border-custom">
              <button
                onClick={handleSaveRole}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-1.5 rounded text-xs cursor-pointer transition-colors shadow-sm"
              >
                Save Role Changes
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-muted border border-border-custom rounded text-xs italic">
            Select or create a role to edit
          </div>
        )}
      </div>
    </div>
  );
}
