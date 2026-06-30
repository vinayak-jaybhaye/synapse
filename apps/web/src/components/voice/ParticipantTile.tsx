"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  UserX,
  Shield,
  Pin,
  PinOff,
  Signal,
  SignalHigh,
  SignalMedium,
} from "lucide-react";
import { ConnectionQuality } from "livekit-client";
import { VoiceParticipant } from "../../features/voice/types";
import { getMediaUrl } from "../../lib/media";
import { modServerMute, modServerDeafen, modDisconnect } from "../../services/api/voice";
import { useAuthStore } from "../../store/auth-store";
import { useVoiceStore } from "../../features/voice/voiceStore";
import { useMembers } from "../../services/query/useMembers";
import { useRoles } from "../../services/query/useRoles";
import { useGuilds } from "../../services/query/useGuilds";

interface ParticipantTileProps {
  participant: VoiceParticipant;
  channelId: string;
  canModerate?: boolean;
  canMuteMembers?: boolean;
  canDeafenMembers?: boolean;
  canMoveMembers?: boolean;
  compact?: boolean;
  isFocused?: boolean;
  onFocusToggle?: () => void;
  isPinned?: boolean;
  onPinToggle?: () => void;
  type?: "camera" | "screenshare";
}

const PRESET_BACKGROUNDS = [
  "bg-[#ff6b6b]", // Coral Red
  "bg-[#f06595]", // Soft Pink
  "bg-[#cc5de8]", // Soft Purple
  "bg-[#845ef7]", // Deep Lavender
  "bg-[#5c7cfa]", // Indigo
  "bg-[#7289da]", // Blurple
  "bg-[#22b8cf]", // Cyan/Teal
  "bg-[#20c997]", // Emerald Mint
  "bg-[#51cf66]", // Soft Green
  "bg-[#fcc419]", // Amber Yellow
  "bg-[#ff922b]", // Warm Orange
  "bg-[#868e96]", // Cool Slate Gray
];

const getTileBgClass = (userId: string) => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PRESET_BACKGROUNDS.length;
  return PRESET_BACKGROUNDS[index];
};

export default function ParticipantTile({
  participant,
  channelId,
  canModerate = false,
  canMuteMembers = false,
  canDeafenMembers = false,
  canMoveMembers = false,
  compact = false,
  isFocused = false,
  onFocusToggle,
  isPinned = false,
  onPinToggle,
  type = "camera",
}: ParticipantTileProps) {
  const { user } = useAuthStore();
  const { room } = useVoiceStore();
  const isSelf = participant.user_id === String(user?.id);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>(
    ConnectionQuality.Unknown,
  );

  // Track participant connection quality updates
  useEffect(() => {
    if (!room) return;
    const p = isSelf ? room.localParticipant : room.remoteParticipants.get(participant.user_id);
    if (!p) return;

    setConnectionQuality(p.connectionQuality);

    const handleQualityChange = (quality: ConnectionQuality) => {
      setConnectionQuality(quality);
    };

    p.on("connectionQualityChanged", handleQualityChange);
    return () => {
      p.off("connectionQualityChanged", handleQualityChange);
    };
  }, [room, participant.user_id, isSelf]);

  const elementRef = useRef<HTMLVideoElement | null>(null);

  const videoRef = useCallback(
    (element: HTMLVideoElement | null) => {
      const track = type === "screenshare" ? participant.screenShareTrack : participant.videoTrack;

      if (elementRef.current && track && typeof track.detach === "function") {
        try {
          track.detach(elementRef.current);
        } catch (err) {
          console.warn("[Voice] Failed to detach track:", err);
        }
      }

      elementRef.current = element;

      if (element && track && typeof track.attach === "function") {
        try {
          track.attach(element);
        } catch (err) {
          console.warn("[Voice] Failed to attach track:", err);
        }
      }
    },
    [participant.videoTrack, participant.screenShareTrack, type],
  );

  const hasVideo = !!participant.videoTrack && participant.video;
  const hasScreenShare = !!participant.screenShareTrack && participant.screen_share;
  const { activeGuildId } = useVoiceStore();
  const guildId = participant.guild_id || activeGuildId;
  const { members } = useMembers(guildId || undefined);

  const member = React.useMemo(() => {
    return members.find((m) => m.user_id === participant.user_id);
  }, [members, participant.user_id]);

  const rawDisplayName =
    member?.display_name ||
    member?.nickname ||
    participant.display_name ||
    participant.username ||
    participant.user_id;

  const displayName = rawDisplayName + (type === "screenshare" ? " (Screen Share)" : "");
  const avatarKey = member?.avatar_key || participant.avatar_key;
  const initials = rawDisplayName.substring(0, 2).toUpperCase();

  const { roles: allRoles } = useRoles(guildId || undefined);
  const { guilds } = useGuilds();
  const activeGuild = guilds.find((g) => g.id === guildId);
  const guildOwnerId = activeGuild?.owner_id;

  const currentUserId = String(user?.id);
  const requesterIsOwner = currentUserId === guildOwnerId;
  const targetIsOwner = participant.user_id === guildOwnerId;

  const currentMember = React.useMemo(() => {
    return members.find((m) => m.user_id === currentUserId);
  }, [members, currentUserId]);

  const targetMember = member;

  const getHighestRolePosition = useCallback(
    (roleIds: string[]) => {
      if (!roleIds || roleIds.length === 0) return -1;
      let maxPos = -1;
      for (const roleId of roleIds) {
        const r = allRoles.find((role) => role.id === roleId);
        if (r && r.position > maxPos) {
          maxPos = r.position;
        }
      }
      return maxPos;
    },
    [allRoles],
  );

  const requesterHighestRolePos = React.useMemo(() => {
    return getHighestRolePosition(currentMember?.roles || []);
  }, [currentMember?.roles, getHighestRolePosition]);

  const targetHighestRolePos = React.useMemo(() => {
    return getHighestRolePosition(targetMember?.roles || []);
  }, [targetMember?.roles, getHighestRolePosition]);

  const canManageTarget = React.useMemo(() => {
    return (
      requesterIsOwner ||
      (requesterHighestRolePos > targetHighestRolePos &&
        !targetIsOwner &&
        currentUserId !== participant.user_id)
    );
  }, [
    requesterIsOwner,
    requesterHighestRolePos,
    targetHighestRolePos,
    targetIsOwner,
    currentUserId,
    participant.user_id,
  ]);

  const handleModMute = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await modServerMute(channelId, participant.user_id, !participant.server_mute).catch(
      console.error,
    );
  };

  const handleModDeafen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await modServerDeafen(channelId, participant.user_id, !participant.server_deaf).catch(
      console.error,
    );
  };

  const handleModDisconnect = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await modDisconnect(channelId, participant.user_id).catch(console.error);
  };

  // Render connection quality indicator icon
  const renderConnectionQuality = () => {
    switch (connectionQuality) {
      case ConnectionQuality.Excellent:
        return (
          <span title="Connection: Excellent">
            <Signal className="h-3.5 w-3.5 text-emerald-400" />
          </span>
        );
      case ConnectionQuality.Good:
        return (
          <span title="Connection: Good">
            <SignalHigh className="h-3.5 w-3.5 text-emerald-500" />
          </span>
        );
      case ConnectionQuality.Poor:
        return (
          <span title="Connection: Poor">
            <SignalMedium className="h-3.5 w-3.5 text-amber-500" />
          </span>
        );
      default:
        return (
          <span title="Connection: Unknown">
            <Signal className="h-3.5 w-3.5 text-text-muted" />
          </span>
        );
    }
  };

  if (compact) {
    return (
      <div
        onClick={onFocusToggle}
        className={`flex items-center gap-3 px-3 py-2 rounded transition-all duration-200 cursor-pointer border ${
          isFocused
            ? "bg-indigo-600/10 border-indigo-500/20 text-text-primary"
            : "border-transparent hover:bg-bg-tertiary/60"
        } group`}
      >
        <div className="relative shrink-0">
          <div
            className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white transition-all duration-300 select-none ${
              participant.speaking
                ? "ring-2 ring-emerald-500 ring-offset-1 ring-offset-bg-secondary"
                : "bg-indigo-600"
            }`}
          >
            {type === "screenshare" ? (
              <Monitor className="h-3.5 w-3.5 text-white/70" />
            ) : avatarKey ? (
              <img
                src={getMediaUrl(avatarKey)}
                className="w-full h-full rounded-full object-cover"
                alt=""
              />
            ) : (
              initials
            )}
          </div>
          {type === "camera" && participant.server_mute && (
            <div className="absolute -bottom-0.5 -right-0.5 bg-red-500 rounded-full h-3 w-3 flex items-center justify-center shadow">
              <MicOff className="h-2 w-2 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-text-primary truncate">{displayName}</div>
          <div className="text-[10px] text-text-muted truncate">
            {type === "screenshare"
              ? "Screen Sharing"
              : participant.speaking
                ? "Speaking"
                : hasVideo
                  ? "Camera On"
                  : "Connected"}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {renderConnectionQuality()}
          {type === "camera" && (
            <>
              {(participant.self_mute || participant.server_mute) && (
                <MicOff
                  className={`h-3.5 w-3.5 ${participant.server_mute ? "text-red-500" : "text-text-muted"}`}
                />
              )}
              {(participant.self_deaf || participant.server_deaf) && (
                <HeadphoneOff className="h-3.5 w-3.5 text-text-muted" />
              )}
              {participant.video && <Video className="h-3.5 w-3.5 text-blue-400" />}
            </>
          )}
          {type === "screenshare" && <Monitor className="h-3.5 w-3.5 text-purple-400" />}
          {onPinToggle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPinToggle();
              }}
              className="text-text-secondary hover:text-text-primary p-0.5 hover:bg-bg-tertiary rounded transition-colors cursor-pointer"
            >
              {isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
            </button>
          )}
        </div>
      </div>
    );
  }

  const isVideoActive =
    type === "screenshare"
      ? !!participant.screenShareTrack
      : !!participant.videoTrack && participant.video;
  const tileBgClass = isVideoActive ? "bg-black" : getTileBgClass(participant.user_id);

  return (
    <div
      onClick={onFocusToggle}
      className={`relative rounded-md overflow-hidden flex flex-col items-center justify-center select-none transition-all duration-300 border cursor-pointer group aspect-video w-full h-full ${tileBgClass} ${
        type === "camera" && participant.speaking
          ? "ring-2 ring-emerald-500 border-transparent"
          : isFocused
            ? "ring-2 ring-indigo-500 border-transparent"
            : "border-border-custom hover:border-text-muted/30"
      }`}
    >
      {/* Top Bar Badges Overlay */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex gap-1.5">
          {type === "screenshare" && (
            <div className="bg-purple-600/90 text-white px-1.5 py-0.5 rounded flex items-center gap-1 text-[9px] font-bold shadow border border-purple-500/20">
              <Monitor className="h-3 w-3" />
              <span>LIVE</span>
            </div>
          )}
          {type === "camera" && participant.video && (
            <div className="bg-blue-600/90 text-white px-1.5 py-0.5 rounded flex items-center gap-1 text-[9px] font-bold shadow border border-blue-500/20">
              <Video className="h-3 w-3" />
              <span>CAMERA</span>
            </div>
          )}
          {type === "camera" && participant.speaking && (
            <div className="bg-emerald-500/95 text-white px-1.5 py-0.5 rounded flex items-center gap-1 text-[9px] font-bold shadow border border-emerald-400/20">
              <span>SPEAKING</span>
            </div>
          )}
        </div>
        <div className="flex gap-1 items-center bg-black/60 backdrop-blur-md px-1.5 py-1 rounded-md border border-white/10 shadow-lg pointer-events-auto">
          {/* Connection status */}
          <div className="flex items-center px-1 border-r border-white/10 mr-0.5">
            {renderConnectionQuality()}
          </div>

          {/* Pin/Unpin Toggle */}
          {onPinToggle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPinToggle();
              }}
              title={isPinned ? "Unpin Participant" : "Pin Participant"}
              className={`p-1 rounded hover:bg-white/10 transition-colors cursor-pointer ${
                isPinned ? "text-indigo-400" : "text-white/80"
              }`}
            >
              {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </button>
          )}

          {/* Focus Toggle */}
          {onFocusToggle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFocusToggle();
              }}
              title={isFocused ? "Restore to Grid" : "Focus Participant"}
              className={`p-1 rounded hover:bg-white/10 transition-colors cursor-pointer ${
                isFocused ? "text-indigo-400" : "text-white/80"
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Moderator Controls */}
          {type === "camera" && !isSelf && canManageTarget && (
            <>
              {canMuteMembers && (
                <button
                  onClick={handleModMute}
                  title={participant.server_mute ? "Remove Server Mute" : "Server Mute"}
                  className={`p-1 rounded hover:bg-white/10 transition-colors cursor-pointer ${
                    participant.server_mute
                      ? "text-red-400 hover:text-red-300"
                      : "text-white/80 hover:text-red-400"
                  }`}
                >
                  {participant.server_mute ? (
                    <Mic className="h-3.5 w-3.5" />
                  ) : (
                    <MicOff className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
              {canDeafenMembers && (
                <button
                  onClick={handleModDeafen}
                  title={participant.server_deaf ? "Remove Server Deafen" : "Server Deafen"}
                  className={`p-1 rounded hover:bg-white/10 transition-colors cursor-pointer ${
                    participant.server_deaf
                      ? "text-red-400 hover:text-red-300"
                      : "text-white/80 hover:text-red-400"
                  }`}
                >
                  {participant.server_deaf ? (
                    <Headphones className="h-3.5 w-3.5" />
                  ) : (
                    <HeadphoneOff className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
              {canMoveMembers && (
                <button
                  onClick={handleModDisconnect}
                  title="Disconnect Member"
                  className="p-1 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                >
                  <UserX className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Video / Screen Share Stream Container */}
      {isVideoActive && (
        <div className="absolute inset-0 w-full h-full bg-black">
          <video
            ref={videoRef}
            autoPlay
            muted={isSelf && type === "camera"}
            playsInline
            className="w-full h-full object-contain"
          />
        </div>
      )}

      {/* Avatar Fallback (when no video) */}
      {!isVideoActive && (
        <div className="flex flex-col items-center justify-center">
          <div
            className={`h-24 w-24 rounded-full flex items-center justify-center text-4xl font-bold transition-all duration-300 select-none relative shadow-md ${
              type === "camera" && participant.speaking
                ? "ring-4 ring-emerald-500 scale-105"
                : "bg-white/10 text-white"
            }`}
          >
            {type === "screenshare" ? (
              <Monitor className="h-10 w-10 text-white/60" />
            ) : avatarKey ? (
              <img
                src={getMediaUrl(avatarKey)}
                className="w-full h-full rounded-full object-cover shadow"
                alt=""
              />
            ) : (
              initials
            )}
          </div>
        </div>
      )}

      {/* Float Corner Name Tag (Bottom-Left) */}
      <div className="absolute bottom-2.5 left-2.5 bg-black/50 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1.5 select-none pointer-events-none">
        <span>{displayName}</span>
        {type === "camera" && isSelf && (
          <span className="text-[8px] bg-white/20 text-white px-1 py-0.2 rounded font-bold uppercase tracking-wider scale-90">
            You
          </span>
        )}
      </div>

      {/* Float Corner Status Badges (Bottom-Right) */}
      {type === "camera" && (
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 pointer-events-none">
          {(participant.self_mute || participant.server_mute) && (
            <div className="bg-black/50 backdrop-blur-sm p-1 rounded-full flex items-center justify-center shrink-0 w-6 h-6 border border-white/5 shadow-md">
              <MicOff className="h-3 w-3 text-red-400" />
            </div>
          )}
          {(participant.self_deaf || participant.server_deaf) && (
            <div className="bg-black/50 backdrop-blur-sm p-1 rounded-full flex items-center justify-center shrink-0 w-6 h-6 border border-white/5 shadow-md">
              <HeadphoneOff className="h-3 w-3 text-red-400" />
            </div>
          )}
          {participant.server_mute && (
            <div className="bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded flex items-center justify-center shrink-0 text-[8px] font-bold text-red-400 border border-white/5 shadow-md uppercase tracking-wider">
              MOD
            </div>
          )}
        </div>
      )}
    </div>
  );
}
