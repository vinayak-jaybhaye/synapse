"use client";

import React, { useState } from "react";
import { useGuildStore } from "../../../store/guild-store";
import { useGuildInvites, useCreateInvite } from "../../../services/query/useInvites";
import { useGuildPermissions } from "../../../hooks/usePermissions";
import { useGuilds } from "../../../services/query/useGuilds";
import { Invite } from "../../../types";
import { Link2, Copy, Trash2, Check, Clock, Plus, RefreshCw } from "lucide-react";

export default function InvitesTab() {
  const { activeGuildId } = useGuildStore();
  const { guilds } = useGuilds();
  const activeGuild = guilds.find((g) => g.id === activeGuildId);
  const { canCreateInstantInvite } = useGuildPermissions(activeGuild?.permissions);

  const { invites, isLoading, isError, refetch, deleteInvite, isDeleting } = useGuildInvites(
    activeGuildId || undefined,
  );
  const { createInvite, isCreating } = useCreateInvite();

  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [maxUses, setMaxUses] = useState<number>(0);
  const [duration, setDuration] = useState<number>(86400); // 24 hours default
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${code}`);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCreate = async () => {
    if (!activeGuildId) return;
    try {
      await createInvite({
        guildId: activeGuildId,
        maxUses: maxUses > 0 ? maxUses : undefined,
        duration: duration > 0 ? duration : undefined,
      });
      setShowCreateModal(false);
      refetch();
    } catch (err) {
      console.error("Failed to create invite:", err);
    }
  };

  const handleDelete = async (code: string) => {
    try {
      setDeletingCode(code);
      await deleteInvite(code);
    } catch (err) {
      console.error("Failed to delete invite:", err);
    } finally {
      setDeletingCode(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Never";
    try {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border-custom shrink-0">
        <div>
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Link2 className="h-5 w-5 text-indigo-400" />
            Active Invites
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Active invite links for this server. You can view usage statistics or revoke any invite
            link.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreateInstantInvite && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Create Invite</span>
            </button>
          )}
          <button
            onClick={() => refetch()}
            className="p-1.5 bg-bg-tertiary border border-border-custom hover:bg-bg-secondary text-text-secondary hover:text-text-primary rounded transition-colors cursor-pointer"
            title="Refresh Invites"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Invites List */}
      <div className="flex-1 overflow-y-auto pt-4 space-y-2.5 pr-1">
        {isLoading ? (
          <div className="flex flex-col gap-2 py-12 items-center justify-center text-text-muted">
            <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
            <span className="text-xs">Loading active invites...</span>
          </div>
        ) : isError ? (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-400 text-center">
            Failed to load active invites.
          </div>
        ) : invites.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center text-text-muted">
            <Link2 className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm font-semibold text-text-secondary">No Active Invites</p>
            <p className="text-xs mt-1">
              There are currently no active invite links for this server.
            </p>
          </div>
        ) : (
          invites.map((inv: Invite) => {
            const isExpired = !!(inv.expires_at && new Date(inv.expires_at).getTime() <= now);
            const isMaxUsesReached = inv.max_uses > 0 && inv.uses >= inv.max_uses;
            const isInvalid = isExpired || isMaxUsesReached;

            return (
              <div
                key={inv.code}
                className={`border rounded-md p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  isInvalid
                    ? "bg-bg-tertiary/40 border-border-custom/40 opacity-60"
                    : "bg-bg-tertiary/70 border-border-custom hover:border-border-custom/80"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-2 border rounded-md shrink-0 ${
                      isInvalid
                        ? "bg-zinc-800/50 border-zinc-700/50 text-zinc-500"
                        : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                    }`}
                  >
                    <Link2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-mono font-bold text-sm tracking-wide ${
                          isInvalid ? "text-text-muted line-through" : "text-text-primary"
                        }`}
                      >
                        {inv.code}
                      </span>
                      {isExpired && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          Expired
                        </span>
                      )}
                      {!isExpired && isMaxUsesReached && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          Limit Reached
                        </span>
                      )}
                      <button
                        onClick={() => handleCopy(inv.code)}
                        className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-bg-secondary transition-colors cursor-pointer"
                        title="Copy Invite Link"
                      >
                        {copiedCode === inv.code ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-text-muted">
                      <span>
                        Uses:{" "}
                        <strong className={isInvalid ? "text-text-muted" : "text-text-secondary"}>
                          {inv.uses}
                        </strong>
                        {inv.max_uses > 0 ? ` / ${inv.max_uses}` : " (Unlimited)"}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Expires: {formatDate(inv.expires_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <button
                  onClick={() => handleDelete(inv.code)}
                  disabled={deletingCode === inv.code || isDeleting}
                  className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{deletingCode === inv.code ? "Revoking..." : "Revoke"}</span>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Create Invite Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-secondary border border-border-custom rounded-md p-5 w-full max-w-md shadow-xl space-y-4">
            <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
              <Plus className="h-4 w-4 text-indigo-400" />
              Create Invite Link
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Expire After
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                  className="w-full bg-bg-tertiary border border-border-custom rounded px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value={1800}>30 Minutes</option>
                  <option value={3600}>1 Hour</option>
                  <option value={21600}>6 Hours</option>
                  <option value={43200}>12 Hours</option>
                  <option value={86400}>1 Day</option>
                  <option value={604800}>7 Days</option>
                  <option value={0}>Never</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Max Uses
                </label>
                <select
                  value={maxUses}
                  onChange={(e) => setMaxUses(parseInt(e.target.value, 10))}
                  className="w-full bg-bg-tertiary border border-border-custom rounded px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value={0}>No Limit</option>
                  <option value={1}>1 Use</option>
                  <option value={5}>5 Uses</option>
                  <option value={10}>10 Uses</option>
                  <option value={25}>25 Uses</option>
                  <option value={50}>50 Uses</option>
                  <option value={100}>100 Uses</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-custom">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 bg-bg-tertiary hover:bg-bg-primary border border-border-custom rounded text-xs text-text-secondary transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {isCreating ? "Creating..." : "Generate Link"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
