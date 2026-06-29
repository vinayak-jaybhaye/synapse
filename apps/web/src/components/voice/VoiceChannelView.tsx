"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Mic, MicOff, Headphones, HeadphoneOff, Video, VideoOff,
    Monitor, MonitorOff, PhoneOff, Wifi, WifiOff, Loader2,
    MessageSquare, Users, Settings, Maximize, Minimize, Send,
    Volume2, X, Plus, AlertCircle, Play, Info
} from "lucide-react";
import { ConnectionState } from "livekit-client";
import { useVoice } from "../../features/voice/useVoice";
import { useVoiceStore } from "../../features/voice/voiceStore";
import ParticipantTile from "./ParticipantTile";
import { useMessages } from "../../services/query/useMessages";
import { getMediaUrl } from "../../lib/media";

interface VoiceChannelViewProps {
    channelName: string;
}

export default function VoiceChannelView({ channelName }: VoiceChannelViewProps) {
    const {
        room,
        connectionState,
        participants,
        selfState,
        activeChannelId,
        toggleMute,
        toggleDeafen,
        toggleVideo,
        toggleScreenShare,
        leaveVoice,
    } = useVoice();

    const isConnected = connectionState === ConnectionState.Connected;
    const isReconnecting = connectionState === ConnectionState.Reconnecting;

    const participantArray = Array.from(participants.values());

    // ── Layout States ────────────────────────────────────────────────────────
    const [focusedId, setFocusedId] = useState<string | null>(null);
    const [pinnedIds, setPinnedIds] = useState<string[]>([]);
    const [customOrder, setCustomOrder] = useState<string[]>([]);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

    // Panel States: "chat" | "participants" | "info" | null
    const [activePanel, setActivePanel] = useState<"chat" | "participants" | "info" | null>(null);

    // Settings Modal State
    const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
    const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
    const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
    const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);

    const [selectedMic, setSelectedMic] = useState<string>("");
    const [selectedCam, setSelectedCam] = useState<string>("");
    const [selectedSpk, setSelectedSpk] = useState<string>("");

    // ── Chat State ───────────────────────────────────────────────────────────
    const { messages, sendMessage } = useMessages(activeChannelId || undefined);
    const [chatInput, setChatInput] = useState<string>("");
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Sync custom order when participants change
    const participantIds = participantArray.map(p => p.user_id);
    useEffect(() => {
        setCustomOrder(prev => {
            const filtered = prev.filter(id => participantIds.includes(id));
            const newIds = participantIds.filter(id => !filtered.includes(id));
            const next = [...filtered, ...newIds];
            if (prev.length === next.length && prev.every((v, i) => v === next[i])) {
                return prev;
            }
            return next;
        });
    }, [participants]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (
                document.activeElement?.tagName === "INPUT" ||
                document.activeElement?.tagName === "TEXTAREA"
            ) {
                return;
            }

            switch (e.key.toLowerCase()) {
                case "m":
                    toggleMute();
                    break;
                case "v":
                    toggleVideo();
                    break;
                case "s":
                    toggleScreenShare();
                    break;
                case "l":
                    leaveVoice();
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [toggleMute, toggleVideo, toggleScreenShare, leaveVoice]);

    // Auto-scroll chat to bottom
    useEffect(() => {
        if (activePanel === "chat") {
            chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, activePanel]);

    // Populate devices list when Settings opens
    useEffect(() => {
        if (!isSettingsOpen) return;
        navigator.mediaDevices.enumerateDevices().then((devices) => {
            setAudioInputs(devices.filter((d) => d.kind === "audioinput"));
            setVideoInputs(devices.filter((d) => d.kind === "videoinput"));
            setAudioOutputs(devices.filter((d) => d.kind === "audiooutput"));
        });
    }, [isSettingsOpen]);

    const handleMicChange = async (deviceId: string) => {
        setSelectedMic(deviceId);
        if (room) {
            await room.switchActiveDevice("audioinput", deviceId);
        }
    };

    const handleCamChange = async (deviceId: string) => {
        setSelectedCam(deviceId);
        if (room) {
            await room.switchActiveDevice("videoinput", deviceId);
        }
    };

    const handleSpkChange = async (deviceId: string) => {
        setSelectedSpk(deviceId);
        if (room) {
            await room.switchActiveDevice("audiooutput", deviceId);
        }
    };

    // Fullscreen toggler
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                setIsFullscreen(true);
            }).catch(console.error);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    useEffect(() => {
        const onFsChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener("fullscreenchange", onFsChange);
        return () => document.removeEventListener("fullscreenchange", onFsChange);
    }, []);

    // Drag and Drop ordering callbacks
    const [draggedId, setDraggedId] = useState<string | null>(null);

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedId(id);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedId || draggedId === targetId) return;

        setCustomOrder(prev => {
            const idx1 = prev.indexOf(draggedId);
            const idx2 = prev.indexOf(targetId);
            const next = [...prev];
            next[idx1] = targetId;
            next[idx2] = draggedId;
            return next;
        });
        setDraggedId(null);
    };

    // Pinning handler
    const handlePinToggle = (id: string) => {
        setPinnedIds(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    // Sorting & prioritizing participants
    // Custom drag order -> Speaking -> Pinned -> Rest
    const getPrioritizedParticipants = () => {
        const sorted = [...participantArray];

        sorted.sort((a, b) => {
            // 1. Pinned priority
            const aPinned = pinnedIds.includes(a.user_id);
            const bPinned = pinnedIds.includes(b.user_id);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;

            // 2. Speaking priority
            if (a.speaking && !b.speaking) return -1;
            if (!a.speaking && b.speaking) return 1;

            // 3. Custom Drag Order priority
            const aIdx = customOrder.indexOf(a.user_id);
            const bIdx = customOrder.indexOf(b.user_id);
            if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;

            return 0;
        });

        return sorted;
    };

    const sortedParticipants = getPrioritizedParticipants();

    // Determine screen sharer
    const screenShareParticipant = participantArray.find((p) => p.screen_share && p.screenShareTrack);

    // Determine the participant in focus
    // Default to screen sharer if active and no custom focus chosen
    const activeFocusParticipant = sortedParticipants.find(
        p => p.user_id === (focusedId || screenShareParticipant?.user_id)
    );

    const handleSendChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        await sendMessage({ content: chatInput.trim() }).catch(console.error);
        setChatInput("");
    };

    if (!activeChannelId) return null;

    return (
        <div className="flex h-full w-full bg-[#0b0c10] text-text-primary overflow-hidden font-sans">
            {/* Main Call Area */}
            <div className="flex-1 flex flex-col h-full min-w-0 relative">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-[#12131a]/80 backdrop-blur-md border-b border-white/5 z-10">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                            <Volume2 className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm text-text-primary select-none">{channelName}</span>
                            <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                                {isReconnecting ? (
                                    <>
                                        <Loader2 className="h-3 w-3 text-amber-400 animate-spin" />
                                        <span className="text-amber-400">Reconnecting...</span>
                                    </>
                                ) : isConnected ? (
                                    <>
                                        <Wifi className="h-3 w-3 text-emerald-400 animate-pulse" />
                                        <span className="text-emerald-400">Connected Securely</span>
                                    </>
                                ) : (
                                    <>
                                        <WifiOff className="h-3 w-3 text-red-400" />
                                        <span className="text-red-400">Disconnected</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Compact Stats Info */}
                        <div className="hidden sm:flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 text-xs text-text-secondary select-none">
                            <Users className="h-3.5 w-3.5 text-indigo-400" />
                            <span>{participantArray.length} participant{participantArray.length !== 1 && "s"}</span>
                        </div>
                    </div>
                </div>

                {/* Grid & Presentation Layout Container */}
                <div className="flex-1 overflow-hidden p-6 relative flex items-center justify-center">
                    {sortedParticipants.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center py-20 text-text-muted animate-fade-in max-w-sm">
                            <div className="h-20 w-20 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/5 shadow-inner">
                                <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
                            </div>
                            <h3 className="font-bold text-text-primary text-base">Setting up Connection</h3>
                            <p className="text-xs text-text-muted mt-1 leading-relaxed">
                                Waiting for LiveKit server signals to configure media streams...
                            </p>
                        </div>
                    ) : activeFocusParticipant ? (
                        /* Focus Layout / Presentation Mode */
                        <div className="flex flex-col lg:flex-row gap-6 w-full h-full min-h-0">
                            {/* Focus Screen View */}
                            <div className="flex-1 min-w-0 bg-[#0f1016] rounded-3xl overflow-hidden border border-white/5 relative flex items-center justify-center group shadow-2xl">
                                <ParticipantTile
                                    participant={activeFocusParticipant}
                                    channelId={activeChannelId}
                                    isFocused={true}
                                    isPinned={pinnedIds.includes(activeFocusParticipant.user_id)}
                                    onPinToggle={() => handlePinToggle(activeFocusParticipant.user_id)}
                                    onFocusToggle={() => setFocusedId(null)}
                                    canModerate
                                />
                            </div>

                            {/* Focus Sidebar (Other Participants List) */}
                            <div className="w-full lg:w-60 flex lg:flex-col gap-4 overflow-x-auto lg:overflow-y-auto lg:h-full shrink-0 select-none pb-2 lg:pb-0 scrollbar-none">
                                {sortedParticipants
                                    .filter(p => p.user_id !== activeFocusParticipant.user_id)
                                    .map(p => (
                                        <div
                                            key={p.user_id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, p.user_id)}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDrop(e, p.user_id)}
                                            className="w-48 lg:w-full aspect-video rounded-2xl overflow-hidden border border-white/5 hover:border-indigo-500/50 shadow-lg hover:scale-[1.02] transition-all duration-300 relative bg-[#0f1016]"
                                        >
                                            <ParticipantTile
                                                participant={p}
                                                channelId={activeChannelId}
                                                compact
                                                isPinned={pinnedIds.includes(p.user_id)}
                                                onPinToggle={() => handlePinToggle(p.user_id)}
                                                onFocusToggle={() => setFocusedId(p.user_id)}
                                                canModerate
                                            />
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ) : (
                        /* Responsive Dynamic Grid View */
                        <div
                            className="grid gap-6 w-full h-full content-center justify-items-center select-none"
                            style={{
                                gridTemplateColumns: `repeat(auto-fit, minmax(${participantArray.length === 1 ? "100%" :
                                        participantArray.length === 2 ? "45%" : "280px"
                                    }, 1fr))`,
                                maxWidth: participantArray.length === 1 ? "600px" : "1200px"
                            }}
                        >
                            {sortedParticipants.map((p) => (
                                <div
                                    key={p.user_id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, p.user_id)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, p.user_id)}
                                    className="w-full h-full flex justify-center"
                                >
                                    <ParticipantTile
                                        participant={p}
                                        channelId={activeChannelId}
                                        isPinned={pinnedIds.includes(p.user_id)}
                                        onPinToggle={() => handlePinToggle(p.user_id)}
                                        onFocusToggle={() => setFocusedId(p.user_id)}
                                        canModerate
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Adaptive Premium Floating Control Bar */}
                <div className="px-6 py-6 flex items-center justify-center shrink-0">
                    <div className="flex items-center gap-3 px-6 py-3.5 bg-[#12131a]/85 backdrop-blur-xl border border-white/5 rounded-3xl shadow-[0_15px_50px_-15px_rgba(0,0,0,0.5)]">
                        {/* Microphone Switcher */}
                        <div className="relative group/control">
                            <button
                                onClick={toggleMute}
                                title={selfState?.self_mute ? "Unmute (M)" : "Mute (M)"}
                                className={`p-3 rounded-2xl transition-all duration-300 hover:scale-105 border flex items-center justify-center cursor-pointer ${selfState?.self_mute || selfState?.server_mute
                                        ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
                                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                                    }`}
                            >
                                {selfState?.self_mute || selfState?.server_mute ? (
                                    <MicOff className="h-5 w-5" />
                                ) : (
                                    <Mic className="h-5 w-5" />
                                )}
                            </button>
                        </div>

                        {/* Deafen Switcher */}
                        <button
                            onClick={toggleDeafen}
                            title={selfState?.self_deaf ? "Undeafen" : "Deafen"}
                            className={`p-3 rounded-2xl transition-all duration-300 hover:scale-105 border flex items-center justify-center cursor-pointer ${selfState?.self_deaf || selfState?.server_deaf
                                    ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
                                    : "bg-white/5 border-white/10 text-text-secondary hover:bg-white/10 hover:text-text-primary"
                                }`}
                        >
                            {selfState?.self_deaf || selfState?.server_deaf ? (
                                <HeadphoneOff className="h-5 w-5" />
                            ) : (
                                <Headphones className="h-5 w-5" />
                            )}
                        </button>

                        {/* Video Camera Switcher */}
                        <button
                            onClick={toggleVideo}
                            title="Toggle Video (V)"
                            className={`p-3 rounded-2xl transition-all duration-300 hover:scale-105 border flex items-center justify-center cursor-pointer ${selfState?.video
                                    ? "bg-blue-500/15 border-blue-500/25 text-blue-400 hover:bg-blue-500/25"
                                    : "bg-white/5 border-white/10 text-text-secondary hover:bg-white/10 hover:text-text-primary"
                                }`}
                        >
                            {selfState?.video ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                        </button>

                        {/* Screen Share Switcher */}
                        <button
                            onClick={toggleScreenShare}
                            title="Share Screen (S)"
                            className={`p-3 rounded-2xl transition-all duration-300 hover:scale-105 border flex items-center justify-center cursor-pointer ${selfState?.screen_share
                                    ? "bg-purple-500/15 border-purple-500/25 text-purple-400 hover:bg-purple-500/25"
                                    : "bg-white/5 border-white/10 text-text-secondary hover:bg-white/10 hover:text-text-primary"
                                }`}
                        >
                            {selfState?.screen_share ? <Monitor className="h-5 w-5" /> : <MonitorOff className="h-5 w-5" />}
                        </button>

                        {/* Settings Button */}
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            title="Device Settings"
                            className="p-3 rounded-2xl transition-all duration-300 hover:scale-105 border border-white/10 bg-white/5 text-text-secondary hover:bg-white/10 hover:text-text-primary flex items-center justify-center cursor-pointer"
                        >
                            <Settings className="h-5 w-5" />
                        </button>

                        <div className="w-px h-8 bg-white/10 mx-1" />

                        {/* Sidebar Chat Panel Toggle */}
                        <button
                            onClick={() => setActivePanel(activePanel === "chat" ? null : "chat")}
                            title="Toggle Chat"
                            className={`p-3 rounded-2xl transition-all duration-300 hover:scale-105 border flex items-center justify-center cursor-pointer ${activePanel === "chat"
                                    ? "bg-indigo-600/20 border-indigo-500/30 text-indigo-400"
                                    : "bg-white/5 border-white/10 text-text-secondary hover:bg-white/10 hover:text-text-primary"
                                }`}
                        >
                            <MessageSquare className="h-5 w-5" />
                        </button>

                        {/* Sidebar Participants Panel Toggle */}
                        <button
                            onClick={() => setActivePanel(activePanel === "participants" ? null : "participants")}
                            title="Toggle Participants"
                            className={`p-3 rounded-2xl transition-all duration-300 hover:scale-105 border flex items-center justify-center cursor-pointer ${activePanel === "participants"
                                    ? "bg-indigo-600/20 border-indigo-500/30 text-indigo-400"
                                    : "bg-white/5 border-white/10 text-text-secondary hover:bg-white/10 hover:text-text-primary"
                                }`}
                        >
                            <Users className="h-5 w-5" />
                        </button>

                        {/* Info / Guild Details Panel Toggle */}
                        <button
                            onClick={() => setActivePanel(activePanel === "info" ? null : "info")}
                            title="Call Info"
                            className={`p-3 rounded-2xl transition-all duration-300 hover:scale-105 border flex items-center justify-center cursor-pointer ${activePanel === "info"
                                    ? "bg-indigo-600/20 border-indigo-500/30 text-indigo-400"
                                    : "bg-white/5 border-white/10 text-text-secondary hover:bg-white/10 hover:text-text-primary"
                                }`}
                        >
                            <Info className="h-5 w-5" />
                        </button>

                        {/* Browser Fullscreen Button */}
                        <button
                            onClick={toggleFullscreen}
                            title="Toggle Fullscreen"
                            className="p-3 rounded-2xl transition-all duration-300 hover:scale-105 border border-white/10 bg-white/5 text-text-secondary hover:bg-white/10 hover:text-text-primary flex items-center justify-center cursor-pointer"
                        >
                            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                        </button>

                        <div className="w-px h-8 bg-white/10 mx-1" />

                        {/* End/Disconnect Call Button */}
                        <button
                            onClick={leaveVoice}
                            title="Disconnect (L)"
                            className="p-3 rounded-2xl bg-red-500 border border-red-400/20 text-white hover:bg-red-600 shadow-lg hover:shadow-red-500/30 hover:scale-105 transition-all duration-300 flex items-center justify-center cursor-pointer"
                        >
                            <PhoneOff className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Collapsible Dockable Panel */}
            {activePanel && (
                <div className="w-80 h-full border-l border-white/5 bg-[#12131a] flex flex-col shrink-0 transition-all duration-300 animate-slide-in relative select-none">
                    {/* Panel Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-black/10">
                        <span className="font-bold text-sm tracking-wide text-text-primary uppercase flex items-center gap-2">
                            {activePanel === "chat" && (
                                <>
                                    <MessageSquare className="h-4 w-4 text-indigo-400" />
                                    <span>Channel Chat</span>
                                </>
                            )}
                            {activePanel === "participants" && (
                                <>
                                    <Users className="h-4 w-4 text-indigo-400" />
                                    <span>Active Users ({participantArray.length})</span>
                                </>
                            )}
                            {activePanel === "info" && (
                                <>
                                    <Info className="h-4 w-4 text-indigo-400" />
                                    <span>Call Information</span>
                                </>
                            )}
                        </span>
                        <button
                            onClick={() => setActivePanel(null)}
                            className="p-1 hover:bg-white/5 rounded-lg text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Panel Content */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                        {activePanel === "chat" && (
                            <div className="h-full flex flex-col">
                                {/* Chat Log list */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                                    {messages.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center text-text-muted py-20 px-4">
                                            <MessageSquare className="h-10 w-10 text-white/5 mb-3" />
                                            <h4 className="font-medium text-xs text-text-primary">No messages yet</h4>
                                            <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
                                                Send a message to everyone in the call.
                                            </p>
                                        </div>
                                    ) : (
                                        messages.map((msg) => (
                                            <div key={msg.id} className="flex gap-3 text-xs leading-relaxed animate-fade-in group">
                                                <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shrink-0 shadow overflow-hidden">
                                                    {msg.author.avatar_key ? (
                                                        <img src={getMediaUrl(msg.author.avatar_key)} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        msg.author.username.charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-baseline justify-between gap-2">
                                                        <span className="font-bold text-text-primary truncate">{msg.author.display_name || msg.author.username}</span>
                                                        <span className="text-[9px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-text-secondary mt-0.5 break-words select-text">{msg.content}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    <div ref={chatEndRef} />
                                </div>

                                {/* Sidebar Composer Input */}
                                <form onSubmit={handleSendChat} className="p-4 border-t border-white/5 bg-black/10">
                                    <div className="flex gap-2 bg-[#0b0c10] border border-white/5 rounded-xl px-3 py-1.5 focus-within:border-indigo-500/50 transition-colors">
                                        <input
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            placeholder="Type a message..."
                                            className="flex-1 bg-transparent border-none text-xs text-text-primary focus:outline-none placeholder:text-text-muted/50"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!chatInput.trim()}
                                            className="text-indigo-400 hover:text-indigo-300 disabled:opacity-40 transition-opacity flex items-center justify-center cursor-pointer"
                                        >
                                            <Send className="h-4.5 w-4.5" />
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {activePanel === "participants" && (
                            <div className="p-4 space-y-2">
                                {sortedParticipants.map((p) => (
                                    <ParticipantTile
                                        key={p.user_id}
                                        participant={p}
                                        channelId={activeChannelId}
                                        compact
                                        isPinned={pinnedIds.includes(p.user_id)}
                                        onPinToggle={() => handlePinToggle(p.user_id)}
                                        onFocusToggle={() => setFocusedId(p.user_id)}
                                        canModerate
                                    />
                                ))}
                            </div>
                        )}

                        {activePanel === "info" && (
                            <div className="p-5 space-y-6 text-xs select-text">
                                <div className="space-y-2">
                                    <h4 className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Channel Session</h4>
                                    <div className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-text-secondary">Name:</span>
                                            <span className="text-text-primary font-medium">{channelName}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-text-secondary">Connected Users:</span>
                                            <span className="text-text-primary font-medium">{participantArray.length}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Media Engine Specs</h4>
                                    <div className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-1.5 font-mono text-[10px] text-text-secondary">
                                        <div>Active Room: {room?.name || "LiveKit Server"}</div>
                                        <div>Codec: Opus (Audio) / VP8 (Video)</div>
                                        <div>Network State: {room?.state || "Unknown"}</div>
                                    </div>
                                </div>
                                <div className="space-y-2 bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-3 text-text-secondary">
                                    <div className="flex gap-2">
                                        <AlertCircle className="h-4 w-4 text-indigo-400 shrink-0" />
                                        <div>
                                            <h5 className="font-bold text-text-primary mb-0.5">Quick Tip</h5>
                                            <p className="leading-relaxed">
                                                Use <kbd className="bg-white/10 px-1 rounded text-white">M</kbd> to toggle microphone, <kbd className="bg-white/10 px-1 rounded text-white">V</kbd> for camera, <kbd className="bg-white/10 px-1 rounded text-white">S</kbd> for screen share, and <kbd className="bg-white/10 px-1 rounded text-white">L</kbd> to hang up.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Custom Settings Modal Panel (Radix-like overlay) */}
            {isSettingsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in">
                    <div className="w-full max-w-md bg-[#12131a] rounded-3xl border border-white/10 shadow-2xl p-6 relative">
                        <button
                            onClick={() => setIsSettingsOpen(false)}
                            className="absolute top-4 right-4 p-1.5 hover:bg-white/5 rounded-lg text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <h3 className="font-bold text-lg text-text-primary mb-4 flex items-center gap-2">
                            <Settings className="h-5 w-5 text-indigo-400" />
                            <span>Voice & Video Settings</span>
                        </h3>

                        <div className="space-y-4">
                            {/* Camera select */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Video Camera</label>
                                <select
                                    value={selectedCam}
                                    onChange={(e) => handleCamChange(e.target.value)}
                                    className="w-full bg-[#0b0c10] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-text-primary focus:outline-none focus:border-indigo-500/50"
                                >
                                    <option value="">Default Camera</option>
                                    {videoInputs.map((d) => (
                                        <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.substring(0, 5)}`}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Microphone select */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Microphone Input</label>
                                <select
                                    value={selectedMic}
                                    onChange={(e) => handleMicChange(e.target.value)}
                                    className="w-full bg-[#0b0c10] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-text-primary focus:outline-none focus:border-indigo-500/50"
                                >
                                    <option value="">Default Microphone</option>
                                    {audioInputs.map((d) => (
                                        <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.substring(0, 5)}`}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Speaker select */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Audio Output (Speaker)</label>
                                <select
                                    value={selectedSpk}
                                    onChange={(e) => handleSpkChange(e.target.value)}
                                    className="w-full bg-[#0b0c10] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-text-primary focus:outline-none focus:border-indigo-500/50"
                                >
                                    <option value="">Default Speaker</option>
                                    {audioOutputs.map((d) => (
                                        <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.substring(0, 5)}`}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => setIsSettingsOpen(false)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-colors cursor-pointer shadow-lg shadow-indigo-500/20"
                            >
                                Save Settings
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
