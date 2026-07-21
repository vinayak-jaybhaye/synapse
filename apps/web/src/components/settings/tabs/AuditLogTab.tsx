"use client";

import React, { useState } from "react";
import { useGuildStore } from "../../../store/guild-store";
import { useAuditLogs } from "../../../services/query/useAuditLogs";
import { AuditLogEntry, AuditAction } from "../../../types";
import {
  FileText,
  Filter,
  User,
  Shield,
  Hash,
  MessageSquare,
  Volume2,
  UserX,
  UserCheck,
  Tag,
  ChevronDown,
  ChevronUp,
  Clock,
  RefreshCw,
} from "lucide-react";

export default function AuditLogTab() {
  const { activeGuildId } = useGuildStore();
  const [selectedAction, setSelectedAction] = useState<number | undefined>(undefined);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  const { auditLogs, isLoading, isError, refetch } = useAuditLogs(activeGuildId || undefined, {
    action: selectedAction,
    limit: 50,
  });

  const toggleExpand = (id: string) => {
    setExpandedEntryId((prev) => (prev === id ? null : id));
  };

  const getActionInfo = (actionId: number, actionName: string) => {
    switch (actionId) {
      case AuditAction.GuildUpdate:
        return {
          label: "Updated Guild",
          icon: Shield,
          color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
        };
      case AuditAction.ChannelCreate:
        return {
          label: "Created Channel",
          icon: Hash,
          color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
        };
      case AuditAction.ChannelUpdate:
        return {
          label: "Updated Channel",
          icon: Hash,
          color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
        };
      case AuditAction.ChannelDelete:
        return {
          label: "Deleted Channel",
          icon: Hash,
          color: "text-rose-400 bg-rose-500/10 border-rose-500/30",
        };
      case AuditAction.ChannelMove:
        return {
          label: "Moved Channel",
          icon: Hash,
          color: "text-blue-400 bg-blue-500/10 border-blue-500/30",
        };
      case AuditAction.ChannelPermissionCreate:
      case AuditAction.ChannelPermissionUpdate:
      case AuditAction.ChannelPermissionDelete:
        return {
          label: "Channel Override",
          icon: Shield,
          color: "text-violet-400 bg-violet-500/10 border-violet-500/30",
        };
      case AuditAction.RoleCreate:
        return {
          label: "Created Role",
          icon: Tag,
          color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
        };
      case AuditAction.RoleUpdate:
        return {
          label: "Updated Role",
          icon: Tag,
          color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
        };
      case AuditAction.RoleDelete:
        return {
          label: "Deleted Role",
          icon: Tag,
          color: "text-rose-400 bg-rose-500/10 border-rose-500/30",
        };
      case AuditAction.MemberKick:
        return {
          label: "Kicked Member",
          icon: UserX,
          color: "text-orange-400 bg-orange-500/10 border-orange-500/30",
        };
      case AuditAction.MemberBan:
        return {
          label: "Banned Member",
          icon: UserX,
          color: "text-rose-500 bg-rose-500/10 border-rose-500/30",
        };
      case AuditAction.MemberUnban:
        return {
          label: "Unbanned Member",
          icon: UserCheck,
          color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
        };
      case AuditAction.MemberNickUpdate:
        return {
          label: "Updated Nickname",
          icon: User,
          color: "text-blue-400 bg-blue-500/10 border-blue-500/30",
        };
      case AuditAction.MemberRoleAdd:
        return {
          label: "Added Role to Member",
          icon: Shield,
          color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
        };
      case AuditAction.MemberRoleRemove:
        return {
          label: "Removed Role from Member",
          icon: Shield,
          color: "text-rose-400 bg-rose-500/10 border-rose-500/30",
        };
      case AuditAction.MemberAdd:
        return {
          label: "Member Joined Server",
          icon: UserCheck,
          color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
        };
      case AuditAction.MemberLeave:
        return {
          label: "Member Left Server",
          icon: UserX,
          color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/30",
        };
      case AuditAction.MessageDelete:
        return {
          label: "Deleted Message",
          icon: MessageSquare,
          color: "text-rose-400 bg-rose-500/10 border-rose-500/30",
        };
      case AuditAction.VoiceDisconnect:
        return {
          label: "Disconnected Voice",
          icon: Volume2,
          color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
        };
      case AuditAction.VoiceMove:
        return {
          label: "Moved Voice Member",
          icon: Volume2,
          color: "text-blue-400 bg-blue-500/10 border-blue-500/30",
        };
      case AuditAction.InviteCreate:
        return {
          label: "Created Invite",
          icon: FileText,
          color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
        };
      default:
        return {
          label: actionName || `Action ${actionId}`,
          icon: FileText,
          color: "text-text-secondary bg-bg-tertiary border-border-custom",
        };
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      }).format(date);
    } catch {
      return dateString;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border-custom shrink-0">
        <div>
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-400" />
            Audit Log
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Chronological log of administrative actions performed within this server.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-1.5 bg-bg-tertiary border border-border-custom hover:bg-bg-secondary text-text-secondary hover:text-text-primary rounded transition-colors cursor-pointer"
          title="Refresh Audit Logs"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 py-3 border-b border-border-custom shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium">
          <Filter className="h-3.5 w-3.5" />
          <span>Filter Action:</span>
        </div>

        <select
          value={selectedAction === undefined ? "" : selectedAction}
          onChange={(e) => {
            const val = e.target.value;
            setSelectedAction(val === "" ? undefined : parseInt(val, 10));
          }}
          className="bg-bg-secondary border border-border-custom rounded px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-indigo-500 cursor-pointer"
        >
          <option value="">All Actions</option>
          <option value={AuditAction.GuildUpdate}>Guild Update</option>
          <option value={AuditAction.ChannelCreate}>Channel Create</option>
          <option value={AuditAction.ChannelUpdate}>Channel Update</option>
          <option value={AuditAction.ChannelDelete}>Channel Delete</option>
          <option value={AuditAction.ChannelMove}>Channel Move</option>
          <option value={AuditAction.RoleCreate}>Role Create</option>
          <option value={AuditAction.RoleUpdate}>Role Update</option>
          <option value={AuditAction.RoleDelete}>Role Delete</option>
          <option value={AuditAction.MemberKick}>Member Kick</option>
          <option value={AuditAction.MemberBan}>Member Ban</option>
          <option value={AuditAction.MemberUnban}>Member Unban</option>
          <option value={AuditAction.MemberNickUpdate}>Member Nickname Update</option>
          <option value={AuditAction.MemberRoleAdd}>Member Role Add</option>
          <option value={AuditAction.MemberRoleRemove}>Member Role Remove</option>
          <option value={AuditAction.MessageDelete}>Message Delete (Moderator)</option>
          <option value={AuditAction.VoiceDisconnect}>Voice Disconnect</option>
          <option value={AuditAction.VoiceMove}>Voice Move</option>
          <option value={AuditAction.InviteCreate}>Invite Create</option>
        </select>
      </div>

      {/* Log Feed List */}
      <div className="flex-1 overflow-y-auto pt-3 space-y-2.5 pr-1">
        {isLoading ? (
          <div className="flex flex-col gap-2 py-8 items-center justify-center text-text-muted">
            <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
            <span className="text-xs">Loading audit logs...</span>
          </div>
        ) : isError ? (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-400 text-center">
            Failed to load audit logs. Verify you have administrator permissions.
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center text-text-muted">
            <FileText className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm font-semibold text-text-secondary">No Audit Log Entries</p>
            <p className="text-xs mt-1">
              Administrative actions matching this filter will appear here.
            </p>
          </div>
        ) : (
          auditLogs.map((entry: AuditLogEntry) => {
            const actionInfo = getActionInfo(entry.action_id, entry.action);
            const ActionIcon = actionInfo.icon;
            const isExpanded = expandedEntryId === entry.id;
            const hasDetails = Boolean(
              entry.reason ||
              (entry.changes && Object.keys(entry.changes).length > 0) ||
              (entry.metadata && Object.keys(entry.metadata).length > 0),
            );

            return (
              <div
                key={entry.id}
                className="bg-bg-tertiary/70 border border-border-custom rounded-md p-3 transition-colors hover:border-border-custom/80"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Actor Avatar / Fallback */}
                    <div className="w-8 h-8 rounded-full bg-bg-secondary border border-border-custom flex items-center justify-center text-text-primary text-xs font-bold shrink-0 uppercase">
                      {entry.actor.username.slice(0, 2)}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Main Sentence */}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-primary">
                        <span className="font-bold text-text-primary">
                          {entry.actor.display_name || entry.actor.username}
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${actionInfo.color}`}
                        >
                          <ActionIcon className="h-3 w-3" />
                          <span>{actionInfo.label}</span>
                        </span>

                        {entry.target?.display && (
                          <span className="font-semibold text-text-secondary bg-bg-secondary px-1.5 py-0.5 rounded border border-border-custom text-[11px]">
                            {entry.target.display}
                          </span>
                        )}
                      </div>

                      {/* Timestamp & Snowflake ID */}
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-text-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(entry.created_at)}
                        </span>
                        <span>•</span>
                        <span>ID: {entry.id}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expand Toggle */}
                  {hasDetails && (
                    <button
                      onClick={() => toggleExpand(entry.id)}
                      className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-bg-secondary transition-colors cursor-pointer shrink-0"
                      title="View Details"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>

                {/* Expanded Details Pane */}
                {isExpanded && hasDetails && (
                  <div className="mt-3 pt-3 border-t border-border-custom/50 space-y-2 text-xs">
                    {/* Reason */}
                    {entry.reason && (
                      <div className="bg-bg-secondary/80 border border-border-custom rounded p-2 text-text-secondary">
                        <span className="font-semibold text-text-primary">Reason: </span>
                        <span>{entry.reason}</span>
                      </div>
                    )}

                    {/* Field Changes Table */}
                    {entry.changes && Object.keys(entry.changes).length > 0 && (
                      <div className="bg-bg-secondary/50 border border-border-custom rounded p-2.5 space-y-1.5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
                          Changes
                        </div>
                        {Object.entries(entry.changes).map(([field, val]) => (
                          <div key={field} className="flex items-center gap-2 text-xs font-mono">
                            <span className="text-indigo-400 font-semibold">{field}:</span>
                            <span className="bg-rose-500/10 text-rose-300 border border-rose-500/20 px-1.5 py-0.5 rounded text-[11px] line-through">
                              {JSON.stringify(val.old)}
                            </span>
                            <span className="text-text-muted">→</span>
                            <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[11px]">
                              {JSON.stringify(val.new)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Metadata */}
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <div className="bg-bg-secondary/50 border border-border-custom rounded p-2.5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
                          Metadata
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                          {Object.entries(entry.metadata).map(([k, v]) => (
                            <div key={k} className="flex items-center gap-1.5 text-text-secondary">
                              <span className="text-text-muted font-semibold">{k}:</span>
                              <span className="text-text-primary font-sans">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
