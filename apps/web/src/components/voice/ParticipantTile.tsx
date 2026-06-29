"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import {
    Mic, MicOff, Headphones, HeadphoneOff, Video, VideoOff,
    Monitor, MonitorOff, UserX, Shield, Pin, PinOff, Signal, SignalHigh, SignalMedium
} from "lucide-react";
import { ConnectionQuality } from "livekit-client";
import { VoiceParticipant } from "../../features/voice/types";
import { getMediaUrl } from "../../lib/media";
import { modServerMute, modServerDeafen, modDisconnect } from "../../services/api/voice";
import { useAuthStore } from "../../store/auth-store";
import { useVoiceStore } from "../../features/voice/voiceStore";
import { useMembers } from "../../services/query/useMembers";

interface ParticipantTileProps {
    participant: VoiceParticipant;
    channelId: string;
    canModerate?: boolean;
    compact?: boolean;
    isFocused?: boolean;
    onFocusToggle?: () => void;
    isPinned?: boolean;
    onPinToggle?: () => void;
}

export default function ParticipantTile({
    participant,
    channelId,
    canModerate = false,
    compact = false,
    isFocused = false,
    onFocusToggle,
    isPinned = false,
    onPinToggle,
}: ParticipantTileProps) {
    const { user } = useAuthStore();
    const { room } = useVoiceStore();
    const isSelf = participant.user_id === String(user?.id);
    const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>(ConnectionQuality.Unknown);

    // Dynamic bandwidth optimization: subscribe or unsubscribe from remote video based on focus/layout
    useEffect(() => {
        if (isSelf || !room) return;
        const remotePart = room.remoteParticipants.get(participant.user_id);
        if (!remotePart) return;

        const updateSubscriptions = () => {
            remotePart.videoTrackPublications.forEach((pub: any) => {
                if (typeof pub.setSubscribed === "function") {
                    // Only subscribe if not compact, or if compact but focused/pinned
                    const shouldSubscribe = !compact || isFocused || isPinned;
                    pub.setSubscribed(shouldSubscribe);
                }
            });
        };

        updateSubscriptions();
    }, [room, participant.user_id, compact, isFocused, isPinned, isSelf]);

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

    const videoElRef = useRef<HTMLVideoElement | null>(null);
    const audioElRef = useRef<HTMLAudioElement | null>(null);

    // Manage video track attachment/detachment
    useEffect(() => {
        const track = participant.screenShareTrack || participant.videoTrack;
        const element = videoElRef.current;
        if (!track || !element || typeof track.attach !== "function") return;

        track.attach(element);
        return () => {
            track.detach(element);
        };
    }, [participant.videoTrack, participant.screenShareTrack]);

    // Manage audio track attachment/detachment
    useEffect(() => {
        if (isSelf) return;
        const track = participant.audioTrack;
        const element = audioElRef.current;
        if (!track || !element || typeof track.attach !== "function") return;

        track.attach(element);
        return () => {
            track.detach(element);
        };
    }, [participant.audioTrack, isSelf]);

    const hasVideo = !!participant.videoTrack && participant.video;
    const hasScreenShare = !!participant.screenShareTrack && participant.screen_share;
    const { activeGuildId } = useVoiceStore();
    const guildId = participant.guild_id || activeGuildId;
    const { members } = useMembers(guildId || undefined);

    const member = React.useMemo(() => {
        return members.find((m) => m.user_id === participant.user_id);
    }, [members, participant.user_id]);

    const displayName = member?.display_name || member?.nickname || participant.display_name || participant.username || participant.user_id;
    const avatarKey = member?.avatar_key || participant.avatar_key;
    const initials = displayName.substring(0, 2).toUpperCase();

    const handleModMute = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await modServerMute(channelId, participant.user_id, !participant.server_mute).catch(console.error);
    };

    const handleModDeafen = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await modServerDeafen(channelId, participant.user_id, !participant.server_deaf).catch(console.error);
    };

    const handleModDisconnect = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await modDisconnect(channelId, participant.user_id).catch(console.error);
    };

    // Render connection quality indicator icon
    const renderConnectionQuality = () => {
        switch (connectionQuality) {
            case ConnectionQuality.Excellent:
                return <span title="Connection: Excellent"><Signal className="h-4 w-4 text-emerald-400" /></span>;
            case ConnectionQuality.Good:
                return <span title="Connection: Good"><SignalHigh className="h-4 w-4 text-emerald-500" /></span>;
            case ConnectionQuality.Poor:
                return <span title="Connection: Poor"><SignalMedium className="h-4 w-4 text-amber-500 animate-pulse" /></span>;
            default:
                return <span title="Connection: Unknown"><Signal className="h-4 w-4 text-gray-500" /></span>;
        }
    };

    if (compact) {
        return (
            <div
                onClick={onFocusToggle}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 cursor-pointer ${isFocused ? "bg-indigo-600/20 border border-indigo-500/30" : "hover:bg-bg-tertiary/60"
                    } group`}
            >
                <div className="relative shrink-0">
                    <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white transition-all duration-300 select-none ${participant.speaking
                                ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-bg-secondary shadow-[0_0_12px_rgba(16,185,129,0.6)] animate-pulse"
                                : "bg-indigo-600"
                            }`}
                    >
                        {avatarKey ? (
                            <img src={getMediaUrl(avatarKey)} className="w-full h-full rounded-full object-cover" alt="" />
                        ) : (
                            initials
                        )}
                    </div>
                    {participant.server_mute && (
                        <div className="absolute -bottom-0.5 -right-0.5 bg-red-500 rounded-full h-3.5 w-3.5 flex items-center justify-center shadow-md">
                            <MicOff className="h-2 w-2 text-white" />
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-text-primary truncate">{displayName}</div>
                    <div className="text-[10px] text-text-muted truncate">
                        {participant.speaking ? "Speaking..." : hasVideo ? "Camera On" : "Connected"}
                    </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    {renderConnectionQuality()}
                    {(participant.self_mute || participant.server_mute) && (
                        <MicOff className={`h-3.5 w-3.5 ${participant.server_mute ? "text-red-500" : "text-text-muted"}`} />
                    )}
                    {(participant.self_deaf || participant.server_deaf) && (
                        <HeadphoneOff className="h-3.5 w-3.5 text-text-muted" />
                    )}
                    {participant.video && <Video className="h-3.5 w-3.5 text-blue-400" />}
                    {participant.screen_share && <Monitor className="h-3.5 w-3.5 text-purple-400" />}
                    {onPinToggle && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onPinToggle(); }}
                            className="text-text-muted hover:text-text-primary p-0.5 hover:bg-white/10 rounded transition-colors"
                        >
                            {isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={onFocusToggle}
            className={`relative rounded-2xl overflow-hidden bg-bg-secondary flex flex-col items-center justify-center select-none transition-all duration-300 border cursor-pointer hover:shadow-2xl group ${participant.speaking
                    ? "ring-2 ring-emerald-500 border-transparent shadow-[0_0_30px_rgba(16,185,129,0.2)] animate-pulse"
                    : isFocused
                        ? "ring-2 ring-indigo-500 border-transparent shadow-[0_0_30px_rgba(99,102,241,0.2)]"
                        : "border-border-custom hover:border-text-muted/30"
                } ${hasVideo || hasScreenShare ? "aspect-video w-full" : "aspect-square w-full max-w-[280px]"}`}
        >
            {/* Top Bar Badges Overlay */}
            <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
                <div className="flex gap-1.5">
                    {participant.screen_share && (
                        <div className="bg-purple-600/90 backdrop-blur-md text-white px-2 py-0.5 rounded-lg flex items-center gap-1 text-[10px] font-bold shadow-lg border border-purple-500/20">
                            <Monitor className="h-3 w-3 animate-pulse" />
                            <span>LIVE</span>
                        </div>
                    )}
                    {participant.video && (
                        <div className="bg-blue-600/90 backdrop-blur-md text-white px-2 py-0.5 rounded-lg flex items-center gap-1 text-[10px] font-bold shadow-lg border border-blue-500/20">
                            <Video className="h-3 w-3" />
                            <span>CAMERA</span>
                        </div>
                    )}
                    {participant.speaking && (
                        <div className="bg-emerald-500/95 backdrop-blur-md text-white px-2 py-0.5 rounded-lg flex items-center gap-1 text-[10px] font-bold shadow-lg border border-emerald-400/20">
                            <span className="flex gap-0.5 items-center">
                                <span className="w-1 h-2.5 bg-white rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="w-1 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                <span className="w-1 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                            </span>
                            <span>SPEAKING</span>
                        </div>
                    )}
                </div>
                <div className="flex gap-1.5 items-center bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/5">
                    {renderConnectionQuality()}
                    {isPinned && <Pin className="h-3.5 w-3.5 text-indigo-400 rotate-45" />}
                </div>
            </div>

            {/* Video / Screen Share Stream Container */}
            {(hasVideo || hasScreenShare) && (
                <div className="absolute inset-0 w-full h-full bg-black">
                    <video
                        ref={videoElRef}
                        autoPlay
                        muted={isSelf}
                        playsInline
                        className="w-full h-full object-contain"
                    />
                </div>
            )}

            {/* Audio Element for Remote Audio */}
            {!isSelf && <audio ref={audioElRef} autoPlay />}

            {/* Premium Avatar Fallback (when no video) */}
            {(!hasVideo && !hasScreenShare) && (
                <div className="flex flex-col items-center gap-4">
                    <div
                        className={`h-24 w-24 rounded-full flex items-center justify-center text-4xl font-bold text-white transition-all duration-300 select-none shadow-2xl relative ${participant.speaking
                                ? "bg-gradient-to-tr from-emerald-500 to-teal-400 scale-105 shadow-[0_0_40px_rgba(16,185,129,0.4)]"
                                : "bg-gradient-to-tr from-indigo-600 to-purple-500"
                            }`}
                    >
                        {avatarKey ? (
                            <img src={getMediaUrl(avatarKey)} className="w-full h-full rounded-full object-cover" alt="" />
                        ) : (
                            initials
                        )}
                        {participant.speaking && (
                            <div className="absolute inset-0 rounded-full border-4 border-emerald-400 animate-ping opacity-25" />
                        )}
                    </div>
                </div>
            )}

            {/* Bottom Status Panel */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-4 py-3 flex items-center justify-between">
                <div className="flex flex-col min-w-0">
                    <span className="text-white text-xs font-semibold truncate flex items-center gap-1.5">
                        {displayName}
                        {isSelf && <span className="text-[9px] bg-white/20 text-white px-1 py-0.5 rounded font-bold uppercase tracking-wider">You</span>}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {(participant.self_mute || participant.server_mute) && (
                        <div className="bg-red-500/20 border border-red-500/30 p-1 rounded-lg">
                            <MicOff className={`h-3.5 w-3.5 ${participant.server_mute ? "text-red-500 font-bold animate-pulse" : "text-red-400"}`} />
                        </div>
                    )}
                    {(participant.self_deaf || participant.server_deaf) && (
                        <div className="bg-gray-500/20 border border-white/10 p-1 rounded-lg">
                            <HeadphoneOff className="h-3.5 w-3.5 text-gray-300" />
                        </div>
                    )}
                    {participant.server_mute && (
                        <span title="Server Muted by Moderator" className="bg-red-500/20 text-red-500 px-1 py-0.5 rounded text-[8px] font-bold tracking-widest flex items-center gap-0.5">
                            <Shield className="h-2 w-2" /> MOD
                        </span>
                    )}
                </div>
            </div>

            {/* Action Overlays / Pin / Moderator Control Menu */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-3 backdrop-blur-sm z-20">
                {/* Pin button */}
                {onPinToggle && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onPinToggle(); }}
                        title={isPinned ? "Unpin Participant" : "Pin Participant"}
                        className={`p-2.5 rounded-full backdrop-blur-md border transition-all duration-200 ${isPinned
                                ? "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700"
                                : "bg-black/60 border-white/10 text-white hover:bg-white/10"
                            }`}
                    >
                        {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </button>
                )}

                {/* Focus button */}
                <button
                    onClick={(e) => { e.stopPropagation(); if (onFocusToggle) onFocusToggle(); }}
                    title={isFocused ? "Restore to Grid" : "Focus Participant"}
                    className={`p-2.5 rounded-full backdrop-blur-md border transition-all duration-200 ${isFocused
                            ? "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700"
                            : "bg-black/60 border-white/10 text-white hover:bg-white/10"
                        }`}
                >
                    <Monitor className="h-4 w-4" />
                </button>

                {/* Moderator Control Menu */}
                {canModerate && !isSelf && (
                    <div className="flex gap-2">
                        <button
                            onClick={handleModMute}
                            title={participant.server_mute ? "Remove Server Mute" : "Server Mute"}
                            className={`p-2.5 rounded-full backdrop-blur-md border transition-all duration-200 ${participant.server_mute
                                    ? "bg-red-600 border-red-500 text-white hover:bg-red-700"
                                    : "bg-black/60 border-white/10 text-white hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30"
                                }`}
                        >
                            {participant.server_mute ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                        </button>
                        <button
                            onClick={handleModDeafen}
                            title={participant.server_deaf ? "Remove Server Deafen" : "Server Deafen"}
                            className={`p-2.5 rounded-full backdrop-blur-md border transition-all duration-200 ${participant.server_deaf
                                    ? "bg-red-600 border-red-500 text-white hover:bg-red-700"
                                    : "bg-black/60 border-white/10 text-white hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30"
                                }`}
                        >
                            {participant.server_deaf ? <Headphones className="h-4 w-4" /> : <HeadphoneOff className="h-4 w-4" />}
                        </button>
                        <button
                            onClick={handleModDisconnect}
                            title="Disconnect Member"
                            className="p-2.5 rounded-full bg-red-600/90 hover:bg-red-600 text-white border border-red-500/30 transition-all duration-200"
                        >
                            <UserX className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
