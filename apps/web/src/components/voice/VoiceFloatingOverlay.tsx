"use client";

import React from "react";
import { Mic, MicOff, Headphones, HeadphoneOff, PhoneOff, Maximize2, Shield } from "lucide-react";
import { useVoice } from "../../features/voice/useVoice";
import { useChannelStore } from "../../store/channel-store";
import { useGuildStore } from "../../store/guild-store";
import { useChannels } from "../../services/query/useChannels";
import { getMediaUrl } from "../../lib/media";

export default function VoiceFloatingOverlay() {
    const {
        activeChannelId: voiceChannelId,
        participants,
        selfState,
        toggleMute,
        toggleDeafen,
        leaveVoice,
    } = useVoice();

    const { activeChannelId: viewedChannelId, selectChannel } = useChannelStore();
    const { activeGuildId } = useGuildStore();
    const { channels } = useChannels(activeGuildId || undefined);

    // If not in a voice channel, or if we are currently viewing the voice channel we're in, don't show the floating overlay
    if (!voiceChannelId || viewedChannelId === voiceChannelId) {
        return null;
    }

    const voiceChannel = channels.find((c) => c.id === voiceChannelId);
    const voiceChannelName = voiceChannel?.name || "Voice Channel";

    const participantArray = Array.from(participants.values());
    const activeSpeakers = participantArray.filter((p) => p.speaking);

    const handleMaximize = () => {
        selectChannel(voiceChannelId);
    };

    const isMuted = selfState?.self_mute ?? false;
    const isDeafened = selfState?.self_deaf ?? false;
    const serverMuted = selfState?.server_mute ?? false;
    const serverDeafened = selfState?.server_deaf ?? false;

    return (
        <div className="fixed bottom-6 right-6 z-50 w-72 bg-bg-secondary/90 backdrop-blur-md border border-border-custom shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-indigo-500/10">
            {/* Top Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-bg-tertiary/50 border-b border-border-custom/50">
                <div className="flex flex-col min-w-0">
                    <span className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Voice Connected</span>
                    <span className="text-xs font-semibold text-text-primary truncate">{voiceChannelName}</span>
                </div>
                <button
                    onClick={handleMaximize}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                    title="Open fullscreen voice grid"
                >
                    <Maximize2 className="h-4 w-4" />
                </button>
            </div>

            {/* Speaking Active Speakers List */}
            <div className="px-4 py-3 min-h-[50px] flex items-center gap-2 overflow-x-auto scrollbar-none">
                {participantArray.slice(0, 5).map((p) => {
                    const displayName = p.display_name || p.username || p.user_id;
                    const initials = displayName.substring(0, 2).toUpperCase();
                    return (
                        <div
                            key={p.user_id}
                            className="relative group shrink-0"
                            title={displayName}
                        >
                            <div
                                className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white transition-all duration-200 ${p.speaking
                                    ? "ring-2 ring-green-500 ring-offset-2 ring-offset-bg-secondary shadow-[0_0_8px_rgba(34,197,94,0.4)]"
                                    : "bg-indigo-600"
                                    }`}
                            >
                                {p.avatar_key ? (
                                    <img src={getMediaUrl(p.avatar_key)} className="w-full h-full rounded-full object-cover" alt="" />
                                ) : (
                                    initials
                                )}
                            </div>
                            {p.server_mute && (
                                <div className="absolute -bottom-0.5 -right-0.5 bg-red-500 rounded-full h-3 w-3 flex items-center justify-center">
                                    <MicOff className="h-2 w-2 text-white" />
                                </div>
                            )}
                        </div>
                    );
                })}

                {participantArray.length > 5 && (
                    <div className="h-9 w-9 rounded-full bg-bg-tertiary flex items-center justify-center text-xs font-bold text-text-muted border border-border-custom">
                        +{participantArray.length - 5}
                    </div>
                )}

                {participantArray.length === 0 && (
                    <span className="text-xs text-text-muted italic">No speakers...</span>
                )}
            </div>

            {/* Control Buttons */}
            <div className="px-4 py-2.5 bg-bg-tertiary/20 flex items-center justify-between border-t border-border-custom/50">
                <div className="flex items-center gap-1">
                    {/* Mute */}
                    <button
                        onClick={toggleMute}
                        disabled={serverMuted}
                        title={serverMuted ? "Server Muted" : isMuted ? "Unmute" : "Mute"}
                        className={`p-2 rounded-lg transition-colors cursor-pointer ${serverMuted
                            ? "text-red-400 opacity-60"
                            : isMuted
                                ? "text-red-400 bg-red-500/10 hover:bg-red-500/20"
                                : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
                            }`}
                    >
                        {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>

                    {/* Deafen */}
                    <button
                        onClick={toggleDeafen}
                        disabled={serverDeafened}
                        title={serverDeafened ? "Server Deafened" : isDeafened ? "Undeafen" : "Deafen"}
                        className={`p-2 rounded-lg transition-colors cursor-pointer ${serverDeafened
                            ? "text-red-400 opacity-60"
                            : isDeafened
                                ? "text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20"
                                : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
                            }`}
                    >
                        {isDeafened ? <HeadphoneOff className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
                    </button>
                </div>

                {/* Disconnect */}
                <button
                    onClick={leaveVoice}
                    title="Disconnect from Voice"
                    className="p-2 bg-red-500 hover:bg-red-600 rounded-lg text-white transition-colors cursor-pointer flex items-center justify-center"
                >
                    <PhoneOff className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
