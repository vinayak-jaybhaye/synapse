"use client";

import React, { useState, useEffect } from "react";
import { useGuildStore } from "../../../store/guild-store";
import { useRoles } from "../../../services/query/useRoles";
import { ALL_PERMISSIONS, togglePermission as togglePermBit } from "../../../lib/permissions";
import { getRoleColorHex } from "../../../lib/utils";
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
    setEditRolePerms(BigInt(role.permissions));
  };

  const handleCreateRole = async () => {
    if (!activeGuildId) return;
    try {
      const newRole = await createRole({ name: "New Role", permissions: "0", color: 0 });
      selectRoleForEditing(newRole);
    } catch (err: any) {
      alert(err.message || "Failed to create role");
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
          permissions: editRolePerms.toString(),
        },
      });
      alert("Role saved successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to save role");
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
    } catch (err: any) {
      alert(err.message || "Failed to delete role");
    }
  };

  const togglePermission = (bit: bigint) => {
    setEditRolePerms((prev) => togglePermBit(prev, bit));
  };

  return (
    <div className="flex-1 flex flex-col gap-6 min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h3 className="text-xl font-bold text-text-primary">Roles Settings</h3>
          <p className="text-xs text-text-muted mt-1">Manage server permissions.</p>
        </div>
        <button
          onClick={handleCreateRole}
          className="bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-xl text-xs text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
        >
          <Plus className="h-4 w-4" />
          <span>Create Role</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
        {/* Roles Side list Panel */}
        <div className="w-full md:w-48 bg-bg-secondary border border-border-custom rounded-xl p-2 overflow-x-auto md:overflow-y-auto no-scrollbar flex flex-row md:flex-col gap-2 md:gap-1.5 shrink-0">
          {[...roles]
            .sort((a, b) => b.position - a.position)
            .map((r) => (
              <button
                key={r.id}
                onClick={() => selectRoleForEditing(r)}
                className={`shrink-0 md:w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left group transition-colors cursor-pointer ${
                  selectedRoleId === r.id
                    ? "bg-bg-primary text-text-primary"
                    : "text-text-secondary hover:bg-bg-primary/50 hover:text-text-primary"
                }`}
              >
                <span className="truncate">{r.name}</span>
                {!r.is_default && (
                  <Trash2
                    className="h-3.5 w-3.5 text-text-muted hover:text-red-400 shrink-0 hidden group-hover:block ml-2"
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
          <div className="flex-1 bg-bg-secondary border border-border-custom rounded-xl p-4 overflow-y-auto space-y-4">
            {/* Role name */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-text-secondary">Role Name</label>
              <input
                type="text"
                value={editRoleName}
                onChange={(e) => setEditRoleName(e.target.value)}
                className="bg-bg-primary border border-border-custom rounded-lg px-3 py-1.5 text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
              />
            </div>

            {/* Role Color Picker */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-secondary">Role Color</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setEditRoleColor(c.value)}
                    style={{ backgroundColor: c.hex }}
                    className={`h-7 w-7 rounded-full border-[2.5px] cursor-pointer shadow-sm relative ${
                      editRoleColor === c.value ? "border-white" : "border-transparent"
                    }`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            {/* Role Permissions Checkboxes */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-text-secondary">Role Permissions</label>
              <div className="border border-border-custom rounded-xl divide-y divide-border-custom/50 bg-bg-primary overflow-hidden">
                {ALL_PERMISSIONS.map((p) => {
                  const isEnabled = (editRolePerms & p.bit) === p.bit;
                  return (
                    <div key={p.name} className="flex items-start justify-between p-3 gap-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-text-primary">{p.name}</span>
                        <span className="text-[10px] text-text-muted">{p.desc}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => togglePermission(p.bit)}
                        className="h-4 w-4 rounded border-border-custom text-indigo-600 focus:ring-indigo-500 mt-0.5 shrink-0 cursor-pointer"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleSaveRole}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs cursor-pointer shadow-md transition-colors"
            >
              Save Role Changes
            </button>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-muted border border-border-custom rounded-xl text-xs italic">
            Select or create a role to edit
          </div>
        )}
      </div>
    </div>
  );
}
