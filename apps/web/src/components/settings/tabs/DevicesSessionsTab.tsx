"use client";

import React, { useEffect, useState, useCallback } from "react";
import { authApi } from "../../../services/api/auth";
import {
  Smartphone,
  Laptop,
  Globe,
  LogOut,
  Trash2,
  ShieldAlert,
  RefreshCw,
  Monitor,
  Clock,
  MapPin,
  Shield,
} from "lucide-react";

/* ─── Types ─── */
interface Device {
  id: string;
  device_id: string;
  device_name: string;
  platform: string;
  is_trusted: boolean;
  status: string; // "ACTIVE" | "REVOKED"
  first_seen_at: string;
  last_seen_at: string;
}

interface Session {
  id: string;
  device_id: string;
  ip_address?: string;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  revoked_at?: string;
  status: string; // "ACTIVE" | "EXPIRED" | "REVOKED"
  device?: {
    id: string;
    device_id: string;
    device_name: string;
    platform: string;
  };
}

/* ─── Normalizers ─── */
function mapDevice(d: any): Device {
  return {
    id: String(d.id || d.ID || ""),
    device_id: String(d.device_id || d.DeviceID || ""),
    device_name: String(d.device_name || d.DeviceName || "Unknown Device"),
    platform: String(d.platform || d.Platform || ""),
    is_trusted: Boolean(d.is_trusted !== undefined ? d.is_trusted : d.IsTrusted),
    status: String(d.status || d.Status || "ACTIVE"),
    first_seen_at: String(d.first_seen_at || d.FirstSeenAt || ""),
    last_seen_at: String(d.last_seen_at || d.LastSeenAt || ""),
  };
}

function mapSession(s: any): Session {
  const rawDev = s.device || s.Device;
  return {
    id: String(s.id || s.ID || ""),
    device_id: String(s.device_id || s.DeviceID || ""),
    ip_address: s.ip_address || s.IPAddress,
    created_at: String(s.created_at || s.CreatedAt || ""),
    last_used_at: String(s.last_used_at || s.LastUsedAt || ""),
    expires_at: String(s.expires_at || s.ExpiresAt || ""),
    revoked_at: s.revoked_at || s.RevokedAt,
    status: String(s.status || s.Status || "ACTIVE"),
    device: rawDev
      ? {
          id: String(rawDev.id || rawDev.ID || ""),
          device_id: String(rawDev.device_id || rawDev.DeviceID || ""),
          device_name: String(rawDev.device_name || rawDev.DeviceName || ""),
          platform: String(rawDev.platform || rawDev.Platform || ""),
        }
      : undefined,
  };
}

/* ─── Date helpers ─── */
function formatRelative(dateStr: string): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "—";
  const diff = Date.now() - date.getTime();
  const future = diff < 0;
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60_000);
  const hours = Math.floor(abs / 3_600_000);
  const days = Math.floor(abs / 86_400_000);
  if (mins < 1) return future ? "in moments" : "just now";
  if (mins < 60) return future ? `in ${mins}m` : `${mins}m ago`;
  if (hours < 24) return future ? `in ${hours}h` : `${hours}h ago`;
  if (days < 30) return future ? `in ${days}d` : `${days}d ago`;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatFull(dateStr: string): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/* ─── Helpers ─── */
function PlatformIcon({ platform, className }: { platform?: string; className?: string }) {
  const p = (platform || "").toLowerCase();
  const cls = className ?? "h-4 w-4";
  if (p === "ios" || p === "android" || p === "mobile") return <Smartphone className={cls} />;
  if (p === "web") return <Globe className={cls} />;
  if (p === "desktop") return <Monitor className={cls} />;
  return <Laptop className={cls} />;
}

function StatusPill({ status, isCurrent }: { status: string; isCurrent?: boolean }) {
  if (isCurrent) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/25">
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
        This device
      </span>
    );
  }
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        Active
      </span>
    );
  }
  if (status === "EXPIRED") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
        Expired
      </span>
    );
  }
  // REVOKED
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-semibold bg-bg-tertiary text-text-muted border border-border-custom">
      Revoked
    </span>
  );
}

/* ─── Main component ─── */
export default function DevicesSessionsTab() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [devs, sessResp] = await Promise.all([
        authApi.getDevices(),
        authApi.getSessions(),
      ]);
      setDevices((devs || []).map(mapDevice));
      const rawSessions = sessResp?.sessions ?? (Array.isArray(sessResp) ? sessResp : []);
      setSessions(rawSessions.map(mapSession));
      setCurrentSessionId(String(sessResp?.current_session_id ?? ""));
    } catch (err: any) {
      setError(err.message || "Failed to load devices and sessions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRevokeSession = async (sessionId: string) => {
    setRevoking((p) => ({ ...p, [sessionId]: true }));
    try {
      await authApi.deleteSession(sessionId);
      await fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to revoke session.");
    } finally {
      setRevoking((p) => ({ ...p, [sessionId]: false }));
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    setRevoking((p) => ({ ...p, [deviceId]: true }));
    try {
      await authApi.deleteDevice(deviceId);
      await fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to revoke device.");
    } finally {
      setRevoking((p) => ({ ...p, [deviceId]: false }));
    }
  };

  /* ── States ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-text-muted text-xs">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2.5 p-3 rounded bg-bg-secondary border border-border-custom text-xs">
        <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-text-primary">Failed to load</p>
          <p className="text-text-muted mt-0.5">{error}</p>
        </div>
        <button
          onClick={fetchData}
          className="shrink-0 px-2.5 py-1 rounded bg-bg-tertiary border border-border-custom hover:border-indigo-500 text-text-secondary hover:text-text-primary text-xs transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const activeSessions = sessions.filter((s) => s.status === "ACTIVE").length;
  const activeDevices  = devices.filter((d) => d.status === "ACTIVE").length;

  /* ── Render ── */
  return (
    <div className="space-y-6 pb-4">

      {/* Section header — matches ProfileTab pattern */}
      <div className="border-b border-border-custom pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary">Devices &amp; Sessions</h3>
          </div>
          <button
            onClick={fetchData}
            className="p-1 rounded hover:bg-bg-secondary border border-transparent hover:border-border-custom text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-[11px] text-text-muted mt-0.5">
          {activeSessions} active session{activeSessions !== 1 ? "s" : ""} across {activeDevices} device{activeDevices !== 1 ? "s" : ""}. Timestamps shown in your local timezone.
        </p>
      </div>

      {/* Device list */}
      {devices.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-text-muted text-xs border border-dashed border-border-custom rounded">
          <Laptop className="h-6 w-6 opacity-30" />
          No devices found.
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((device, di) => {
            const isRevoked = device.status === "REVOKED";
            const deviceSessions = sessions.filter(
              (s) => s.device_id === device.id || (s.device && s.device.device_id === device.device_id)
            );
            const hasCurrentSession = deviceSessions.some((s) => s.id === currentSessionId);

            return (
              <div
                key={device.id || di}
                className={`bg-bg-secondary rounded border transition-colors ${
                  isRevoked
                    ? "border-border-custom opacity-60"
                    : hasCurrentSession
                    ? "border-indigo-500/40"
                    : "border-border-custom"
                }`}
              >
                {/* ── Device header ── */}
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Icon */}
                    <div
                      className={`shrink-0 h-7 w-7 rounded flex items-center justify-center ${
                        hasCurrentSession && !isRevoked
                          ? "bg-indigo-500/10 text-indigo-400"
                          : "bg-bg-tertiary text-text-muted"
                      }`}
                    >
                      <PlatformIcon platform={device.platform} className="h-4 w-4" />
                    </div>

                    {/* Name + meta */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-text-primary truncate">
                          {device.device_name}
                        </span>
                        {isRevoked && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-bg-tertiary text-text-muted border border-border-custom">
                            Revoked
                          </span>
                        )}
                        {!isRevoked && hasCurrentSession && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 inline-flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                            Current device
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-text-muted capitalize">
                          {device.platform || "Unknown platform"}
                        </span>
                        <span
                          className="text-[10px] text-text-muted flex items-center gap-0.5"
                          title={formatFull(device.last_seen_at)}
                        >
                          <Clock className="h-3 w-3 shrink-0" />
                          Active {formatRelative(device.last_seen_at)}
                        </span>
                        <span
                          className="text-[10px] text-text-muted"
                          title={formatFull(device.first_seen_at)}
                        >
                          Added {formatRelative(device.first_seen_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Revoke device */}
                  {!isRevoked && (
                    <button
                      id={`revoke-device-${device.id}`}
                      onClick={() => handleRevokeDevice(device.id)}
                      disabled={revoking[device.id]}
                      className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium bg-bg-tertiary border border-border-custom text-red-400 hover:bg-red-500/10 hover:border-red-500/30 disabled:opacity-50 transition-colors cursor-pointer"
                      title="Revoke device and all its sessions"
                    >
                      {revoking[device.id]
                        ? <RefreshCw className="h-3 w-3 animate-spin" />
                        : <Trash2 className="h-3 w-3" />
                      }
                      <span className="hidden sm:inline">Revoke</span>
                    </button>
                  )}
                </div>

                {/* ── Sessions ── */}
                {deviceSessions.length > 0 && (
                  <div className="border-t border-border-custom">
                    <div className="px-3 pt-2 pb-1">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                        Sessions ({deviceSessions.length})
                      </span>
                    </div>

                    <div className="divide-y divide-border-custom/50">
                      {deviceSessions.map((session, si) => {
                        const isCurrent = session.id === currentSessionId;
                        const isActive  = session.status === "ACTIVE";

                        return (
                          <div
                            key={session.id || si}
                            className={`flex items-center justify-between px-3 py-2 gap-3 ${
                              isCurrent ? "bg-indigo-500/[0.04]" : ""
                            }`}
                          >
                            {/* Session info */}
                            <div className="flex items-start gap-2 min-w-0">
                              {/* Status dot */}
                              <div className="shrink-0 mt-1.5">
                                <span
                                  className={`h-1.5 w-1.5 rounded-full inline-block ${
                                    isActive ? "bg-emerald-400" : "bg-zinc-600"
                                  }`}
                                />
                              </div>

                              <div className="min-w-0">
                                {/* IP + status pill */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[11px] font-mono text-text-primary flex items-center gap-1">
                                    <MapPin className="h-3 w-3 text-text-muted shrink-0" />
                                    {session.ip_address || "Unknown IP"}
                                  </span>
                                  <StatusPill status={session.status} isCurrent={isCurrent} />
                                </div>

                                {/* Timestamps */}
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span
                                    className="text-[10px] text-text-muted"
                                    title={formatFull(session.created_at)}
                                  >
                                    Signed in {formatRelative(session.created_at)}
                                  </span>
                                  {isActive && (
                                    <>
                                      <span className="text-border-custom">·</span>
                                      <span
                                        className="text-[10px] text-text-muted"
                                        title={formatFull(session.last_used_at)}
                                      >
                                        Used {formatRelative(session.last_used_at)}
                                      </span>
                                      <span className="text-border-custom">·</span>
                                      <span
                                        className="text-[10px] text-text-muted"
                                        title={formatFull(session.expires_at)}
                                      >
                                        Expires {formatRelative(session.expires_at)}
                                      </span>
                                    </>
                                  )}
                                  {session.status === "EXPIRED" && (
                                    <>
                                      <span className="text-border-custom">·</span>
                                      <span
                                        className="text-[10px] text-amber-500/70"
                                        title={formatFull(session.expires_at)}
                                      >
                                        Expired {formatRelative(session.expires_at)}
                                      </span>
                                    </>
                                  )}
                                  {session.status === "REVOKED" && session.revoked_at && (
                                    <>
                                      <span className="text-border-custom">·</span>
                                      <span
                                        className="text-[10px] text-text-muted"
                                        title={formatFull(session.revoked_at)}
                                      >
                                        Revoked {formatRelative(session.revoked_at)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Revoke session button */}
                            {isActive && (
                              <button
                                id={`revoke-session-${session.id}`}
                                onClick={() => handleRevokeSession(session.id)}
                                disabled={revoking[session.id]}
                                className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer disabled:opacity-50 ${
                                  isCurrent
                                    ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                                    : "border-border-custom text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
                                }`}
                                title={isCurrent ? "Log out" : "Revoke session"}
                              >
                                {revoking[session.id]
                                  ? <RefreshCw className="h-3 w-3 animate-spin" />
                                  : <LogOut className="h-3 w-3" />
                                }
                                {isCurrent ? "Log out" : "Revoke"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
