"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Wifi,
  WifiOff,
  Loader2,
  MessageSquare,
  Users,
  Maximize,
  Minimize,
  Volume2,
  X,
  Menu,
} from "lucide-react";
import { useUIStore } from "../../store/ui-store";
import { useGuildStore } from "../../store/guild-store";
import { useChannels } from "../../services/query/useChannels";
import { ConnectionState, RoomEvent } from "livekit-client";
import { useVoice } from "../../features/voice/useVoice";
import { useVoiceStore } from "../../features/voice/voiceStore";
import ParticipantTile from "./ParticipantTile";
import { useMessages } from "../../services/query/useMessages";
import MessageItem from "../chat/MessageItem";
import MessageComposer from "../chat/MessageComposer";
import TypingIndicator from "../chat/TypingIndicator";
import { useChannelPermissions } from "../../hooks/usePermissions";
import { Message } from "../../types";
import { VoiceParticipant } from "../../features/voice/types";

interface VoiceChannelViewProps {
  channelName: string;
}

interface GridItem {
  id: string; // "user_id-camera" or "user_id-screenshare"
  user_id: string;
  type: "camera" | "screenshare";
  participant: VoiceParticipant;
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
  const { setMobileChannelsOpen } = useUIStore();
  const { activeGuildId } = useGuildStore();
  const { channels } = useChannels(activeGuildId || undefined);

  const channel = channels.find((c) => c.id === activeChannelId);
  const { canManageMessages, canAddReactions, canMuteMembers, canDeafenMembers, canMoveMembers } =
    useChannelPermissions(channel?.permissions, false);

  const isConnected = connectionState === ConnectionState.Connected;
  const isReconnecting = connectionState === ConnectionState.Reconnecting;

  const participantArray = Array.from(participants.values());

  // ── Layout States ────────────────────────────────────────────────────────
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Panel States: "chat" | "participants" | null
  const [activePanel, setActivePanel] = useState<"chat" | "participants" | null>(null);

  // Sidebar Resizing States
  const [sidebarWidth, setSidebarWidth] = useState<number>(320);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  // ── Chat State ───────────────────────────────────────────────────────────
  const {
    messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isChatLoading,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
  } = useMessages(activeChannelId || undefined);

  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  const startWidthRef = useRef(320);
  const startXRef = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const startResizing = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startXRef.current = e.clientX;
      startWidthRef.current = sidebarWidth;
      setIsResizing(true);
    },
    [sidebarWidth],
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startXRef.current - e.clientX; // drag left to increase width
      const newWidth = Math.max(240, Math.min(480, startWidthRef.current + deltaX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Sync custom order when participants change
  const participantIds = participantArray.map((p) => p.user_id);
  useEffect(() => {
    setCustomOrder((prev) => {
      const filtered = prev.filter((id) => participantIds.includes(id));
      const newIds = participantIds.filter((id) => !filtered.includes(id));
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
  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (activePanel === "chat") {
      scrollToBottom();
      setTimeout(scrollToBottom, 80);
    }
  }, [messages.length, activePanel]);

  // Handle scroll events to toggle scroll-to-bottom indicator button
  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const scrolledUp = container.scrollHeight - container.scrollTop - container.clientHeight > 300;
    setShowScrollBottomBtn(scrolledUp);
  };

  // Infinite scroll hook for chat history
  useEffect(() => {
    const observerTarget = observerRef.current;
    if (!observerTarget || !hasNextPage || activePanel !== "chat") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          const container = scrollRef.current;
          const previousScrollHeight = container ? container.scrollHeight : 0;

          fetchNextPage().then(() => {
            requestAnimationFrame(() => {
              if (container) {
                container.scrollTop = container.scrollHeight - previousScrollHeight;
              }
            });
          });
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(observerTarget);
    return () => {
      observer.unobserve(observerTarget);
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, messages.length, activePanel]);

  // Fullscreen toggler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => {
          setIsFullscreen(true);
        })
        .catch(console.error);
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

    setCustomOrder((prev) => {
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
    setPinnedIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  // Sorting & prioritizing participants
  const getPrioritizedParticipants = () => {
    const sorted = [...participantArray];

    sorted.sort((a, b) => {
      // 1. Pinned priority (by user ID)
      const aPinned =
        pinnedIds.includes(`${a.user_id}-camera`) || pinnedIds.includes(`${a.user_id}-screenshare`);
      const bPinned =
        pinnedIds.includes(`${b.user_id}-camera`) || pinnedIds.includes(`${b.user_id}-screenshare`);
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

  // Convert sorted participants to distinct grid items (camera feed and screen share feed separately)
  const getGridItems = (participantsList: typeof sortedParticipants) => {
    const items: GridItem[] = [];

    participantsList.forEach((p) => {
      // Always add the camera/audio feed tile
      items.push({
        id: `${p.user_id}-camera`,
        user_id: p.user_id,
        type: "camera",
        participant: p,
      });

      // Add a separate screenshare tile if they are screen sharing
      if (p.screen_share && p.screenShareTrack) {
        items.push({
          id: `${p.user_id}-screenshare`,
          user_id: p.user_id,
          type: "screenshare",
          participant: p,
        });
      }
    });

    return items;
  };

  const gridItems = getGridItems(sortedParticipants);

  // Determine screen sharer
  const screenShareParticipant = participantArray.find((p) => p.screen_share && p.screenShareTrack);

  // Auto-focus screenshare when it starts, or return to grid when it stops
  const prevScreenShareIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentScreenShareId = screenShareParticipant?.user_id || null;
    const targetFocusId = currentScreenShareId ? `${currentScreenShareId}-screenshare` : null;

    if (currentScreenShareId && currentScreenShareId !== prevScreenShareIdRef.current) {
      setFocusedId(targetFocusId);
    } else if (
      !currentScreenShareId &&
      prevScreenShareIdRef.current &&
      focusedId === `${prevScreenShareIdRef.current}-screenshare`
    ) {
      setFocusedId(null);
    }
    prevScreenShareIdRef.current = currentScreenShareId;
  }, [screenShareParticipant?.user_id, focusedId]);

  // Manage video track subscriptions globally for the voice channel view
  useEffect(() => {
    if (!room) return;

    const subscribeAllRemote = () => {
      room.remoteParticipants.forEach((participant) => {
        participant.videoTrackPublications.forEach((pub: any) => {
          if (typeof pub.setSubscribed === "function") {
            pub.setSubscribed(true);
          }
        });
      });
    };

    subscribeAllRemote();

    const handleTrackPublished = (pub: any) => {
      if (pub.kind === "video" && typeof pub.setSubscribed === "function") {
        pub.setSubscribed(true);
      }
    };

    room.on(RoomEvent.TrackPublished, handleTrackPublished);

    return () => {
      room.off(RoomEvent.TrackPublished, handleTrackPublished);
      // Unsubscribe all when VoiceChannelView is unmounted
      room.remoteParticipants.forEach((participant) => {
        participant.videoTrackPublications.forEach((pub: any) => {
          if (typeof pub.setSubscribed === "function") {
            pub.setSubscribed(false);
          }
        });
      });
    };
  }, [room]);

  // Determine the grid item in focus
  const activeFocusItem = focusedId ? gridItems.find((item) => item.id === focusedId) : null;

  const handleSendChat = async (content: string, uploadIds?: string[]) => {
    try {
      const mentions = Array.from(content.matchAll(/<@(\d+)>/g)).map((match) => match[1]);

      await sendMessage({
        content,
        attachmentUploadIds: uploadIds,
        replyToMessageId: replyTarget?.id,
        mentions,
      });
      setReplyTarget(null);
      scrollToBottom("smooth");
    } catch (err) {
      console.error(err);
    }
  };

  const getGridConfig = (count: number) => {
    if (count === 1) return "grid-cols-1 w-full max-w-[640px] aspect-video";
    if (count === 2) return "grid-cols-1 sm:grid-cols-2 w-full max-w-[960px] gap-2.5";
    if (count <= 4) return "grid-cols-2 w-full max-w-[960px] gap-2.5";
    return "grid-cols-2 sm:grid-cols-3 w-full max-w-[1200px] gap-2.5";
  };

  if (!activeChannelId) return null;

  return (
    <div className="flex h-full w-full bg-bg-primary text-text-primary overflow-hidden font-sans select-none relative">
      {/* Main Call Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-bg-secondary/80 border-b border-border-custom z-10">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Menu trigger */}
            <button
              onClick={() => setMobileChannelsOpen(true)}
              className="md:hidden p-1.5 hover:bg-bg-tertiary rounded text-text-secondary hover:text-text-primary shrink-0 cursor-pointer"
              aria-label="Toggle channels sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center justify-center h-8 w-8 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
              <Volume2 className="h-4 w-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm text-text-primary truncate">{channelName}</span>
              <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                {isReconnecting ? (
                  <>
                    <Loader2 className="h-3 w-3 text-amber-400 animate-spin" />
                    <span className="text-amber-400">Reconnecting...</span>
                  </>
                ) : isConnected ? (
                  <>
                    <Wifi className="h-3 w-3 text-emerald-400" />
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
            <div className="hidden sm:flex items-center gap-2 bg-bg-tertiary px-3 py-1.5 rounded border border-border-custom text-xs text-text-secondary">
              <Users className="h-3.5 w-3.5 text-indigo-400" />
              <span>
                {participantArray.length} participant
                {participantArray.length !== 1 && "s"}
              </span>
            </div>
          </div>
        </div>

        {/* Grid & Presentation Layout Container */}
        <div className="flex-1 overflow-hidden p-4 sm:p-6 relative flex items-center justify-center">
          {gridItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 text-text-muted animate-fade-in max-w-sm">
              <div className="h-16 w-16 rounded-full bg-bg-secondary flex items-center justify-center mb-4 border border-border-custom shadow-inner">
                <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
              </div>
              <h3 className="font-bold text-text-primary text-sm">Setting up Connection</h3>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                Waiting for LiveKit server signals to configure media streams...
              </p>
            </div>
          ) : activeFocusItem ? (
            /* Focus Layout / Presentation Mode */
            <div className="flex flex-col lg:flex-row gap-6 w-full h-full min-h-0">
              {/* Focus Screen View */}
              <div className="flex-1 min-w-0 bg-bg-secondary rounded-md overflow-hidden border border-border-custom relative flex items-center justify-center group shadow-md">
                <ParticipantTile
                  participant={activeFocusItem.participant}
                  type={activeFocusItem.type}
                  channelId={activeChannelId}
                  isFocused={true}
                  isPinned={pinnedIds.includes(activeFocusItem.id)}
                  onPinToggle={() => handlePinToggle(activeFocusItem.id)}
                  onFocusToggle={() => setFocusedId(null)}
                  canMuteMembers={canMuteMembers}
                  canDeafenMembers={canDeafenMembers}
                  canMoveMembers={canMoveMembers}
                />
              </div>

              {/* Focus Sidebar (Other Participants List) */}
              <div className="w-full lg:w-60 flex lg:flex-col gap-4 overflow-x-auto lg:overflow-y-auto lg:h-full shrink-0 select-none pb-2 lg:pb-0 scrollbar-none">
                {gridItems
                  .filter((item) => item.id !== activeFocusItem.id)
                  .map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item.user_id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, item.user_id)}
                      className="w-44 lg:w-full aspect-video rounded-md overflow-hidden border border-border-custom hover:border-indigo-500/50 shadow hover:scale-[1.01] transition-all duration-300 relative bg-bg-secondary"
                    >
                      <ParticipantTile
                        participant={item.participant}
                        type={item.type}
                        channelId={activeChannelId}
                        isPinned={pinnedIds.includes(item.id)}
                        onPinToggle={() => handlePinToggle(item.id)}
                        onFocusToggle={() => setFocusedId(item.id)}
                        canMuteMembers={canMuteMembers}
                        canDeafenMembers={canDeafenMembers}
                        canMoveMembers={canMoveMembers}
                      />
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            /* Responsive Dynamic Grid View (Fit Together) */
            <div
              className={`grid ${getGridConfig(gridItems.length)} justify-center content-center select-none`}
            >
              {gridItems.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item.user_id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, item.user_id)}
                  className="w-full h-full flex justify-center"
                >
                  <ParticipantTile
                    participant={item.participant}
                    type={item.type}
                    channelId={activeChannelId}
                    isPinned={pinnedIds.includes(item.id)}
                    onPinToggle={() => handlePinToggle(item.id)}
                    onFocusToggle={() => setFocusedId(item.id)}
                    canMuteMembers={canMuteMembers}
                    canDeafenMembers={canDeafenMembers}
                    canMoveMembers={canMoveMembers}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Floating Control Bar */}
        <div className="px-4 py-4 sm:py-6 flex items-center justify-center shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5 sm:py-3.5 bg-bg-secondary/95 border border-border-custom rounded shadow-md">
            {/* Microphone Switcher */}
            <button
              onClick={toggleMute}
              title={selfState?.self_mute ? "Unmute (M)" : "Mute (M)"}
              className={`p-2.5 rounded transition-all duration-300 border flex items-center justify-center cursor-pointer ${
                selfState?.self_mute || selfState?.server_mute
                  ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
              }`}
            >
              {selfState?.self_mute || selfState?.server_mute ? (
                <MicOff className="h-4.5 w-4.5" />
              ) : (
                <Mic className="h-4.5 w-4.5" />
              )}
            </button>

            {/* Deafen Switcher */}
            <button
              onClick={toggleDeafen}
              title={selfState?.self_deaf ? "Undeafen" : "Deafen"}
              className={`p-2.5 rounded transition-all duration-300 border flex items-center justify-center cursor-pointer ${
                selfState?.self_deaf || selfState?.server_deaf
                  ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
                  : "bg-bg-tertiary border-border-custom text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
              }`}
            >
              {selfState?.self_deaf || selfState?.server_deaf ? (
                <HeadphoneOff className="h-4.5 w-4.5" />
              ) : (
                <Headphones className="h-4.5 w-4.5" />
              )}
            </button>

            {/* Video Camera Switcher */}
            <button
              onClick={toggleVideo}
              title="Toggle Video (V)"
              className={`p-2.5 rounded transition-all duration-300 border flex items-center justify-center cursor-pointer ${
                selfState?.video
                  ? "bg-blue-500/15 border-blue-500/25 text-blue-400 hover:bg-blue-500/25"
                  : "bg-bg-tertiary border-border-custom text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
              }`}
            >
              {selfState?.video ? (
                <Video className="h-4.5 w-4.5" />
              ) : (
                <VideoOff className="h-4.5 w-4.5" />
              )}
            </button>

            {/* Screen Share Switcher - Hidden on mobile viewports */}
            <button
              onClick={toggleScreenShare}
              title="Share Screen (S)"
              className={`hidden sm:flex p-2.5 rounded transition-all duration-300 border items-center justify-center cursor-pointer ${
                selfState?.screen_share
                  ? "bg-purple-500/15 border-purple-500/25 text-purple-400 hover:bg-purple-500/25"
                  : "bg-bg-tertiary border-border-custom text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
              }`}
            >
              {selfState?.screen_share ? (
                <Monitor className="h-4.5 w-4.5" />
              ) : (
                <MonitorOff className="h-4.5 w-4.5" />
              )}
            </button>

            <div className="w-px h-6 bg-border-custom mx-1 shrink-0" />

            {/* Chat Panel Toggle */}
            <button
              onClick={() => setActivePanel(activePanel === "chat" ? null : "chat")}
              title="Toggle Chat"
              className={`p-2.5 rounded transition-all duration-300 border flex items-center justify-center cursor-pointer ${
                activePanel === "chat"
                  ? "bg-indigo-600/10 border-indigo-500/20 text-indigo-400"
                  : "bg-bg-tertiary border-border-custom text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
              }`}
            >
              <MessageSquare className="h-4.5 w-4.5" />
            </button>

            {/* Participants Panel Toggle */}
            <button
              onClick={() => setActivePanel(activePanel === "participants" ? null : "participants")}
              title="Toggle Participants"
              className={`p-2.5 rounded transition-all duration-300 border flex items-center justify-center cursor-pointer ${
                activePanel === "participants"
                  ? "bg-indigo-600/10 border-indigo-500/20 text-indigo-400"
                  : "bg-bg-tertiary border-border-custom text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
              }`}
            >
              <Users className="h-4.5 w-4.5" />
            </button>

            {/* Browser Fullscreen Button - Hidden on mobile viewports */}
            <button
              onClick={toggleFullscreen}
              title="Toggle Fullscreen"
              className="hidden sm:flex p-2.5 rounded border border-border-custom bg-bg-tertiary text-text-secondary hover:bg-bg-secondary hover:text-text-primary items-center justify-center cursor-pointer transition-colors"
            >
              {isFullscreen ? (
                <Minimize className="h-4.5 w-4.5" />
              ) : (
                <Maximize className="h-4.5 w-4.5" />
              )}
            </button>

            <div className="w-px h-6 bg-border-custom mx-1 shrink-0" />

            {/* Disconnect Call Button */}
            <button
              onClick={leaveVoice}
              title="Disconnect (L)"
              className="p-2.5 rounded bg-red-500 border border-red-500/20 text-white hover:bg-red-600 transition-all duration-200 flex items-center justify-center cursor-pointer shadow"
            >
              <PhoneOff className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Collapsible Panel (Responsive Overlay on Mobile/Tablet, Sidebar on Desktop) */}
      {activePanel && (
        <div
          style={mounted && window.innerWidth >= 1024 ? { width: `${sidebarWidth}px` } : undefined}
          className="fixed inset-x-0 top-0 bottom-[92px] lg:bottom-0 lg:relative lg:inset-auto h-auto lg:h-full lg:w-auto border-l border-border-custom bg-bg-secondary flex flex-col z-40 lg:z-10 select-none animate-slide-in"
        >
          {/* Resize Handle (Desktop Only - lg and above) */}
          <div
            onMouseDown={startResizing}
            className="hidden lg:block absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-500/40 active:bg-indigo-500 transition-colors z-30"
          />

          {/* Panel Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-custom bg-bg-tertiary/40">
            <span className="font-bold text-xs tracking-wider text-text-primary uppercase flex items-center gap-2">
              {activePanel === "chat" && (
                <>
                  <MessageSquare className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Channel Chat</span>
                </>
              )}
              {activePanel === "participants" && (
                <>
                  <Users className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Active Users ({participantArray.length})</span>
                </>
              )}
            </span>
            <button
              onClick={() => setActivePanel(null)}
              className="p-1 hover:bg-bg-tertiary rounded text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 flex flex-col min-h-0">
            {activePanel === "chat" && (
              <div className="flex-1 flex flex-col min-h-0 relative">
                {/* Messages Scroll Area */}
                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto p-4 space-y-6 relative"
                  role="region"
                  aria-label="Voice channel chat messages"
                >
                  {/* Infinite Scroll Top Trigger */}
                  {hasNextPage && (
                    <div ref={observerRef} className="h-8 flex items-center justify-center py-2">
                      {isFetchingNextPage ? (
                        <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
                      ) : (
                        <span className="text-[10px] text-text-muted">Load more history</span>
                      )}
                    </div>
                  )}

                  {/* Start of channel banner */}
                  {!hasNextPage && !isChatLoading && (
                    <div className="flex flex-col gap-1.5 pb-4 border-b border-border-custom/40">
                      <div className="h-10 w-10 rounded bg-bg-tertiary flex items-center justify-center font-bold text-text-primary text-xl select-none mb-1">
                        <Volume2 className="h-5 w-5" />
                      </div>
                      <h2 className="text-sm font-bold text-text-primary">
                        Welcome to the #{channelName} call chat!
                      </h2>
                      <p className="text-text-secondary text-[11px]">
                        This is the beginning of the text chat for this voice call.
                      </p>
                    </div>
                  )}

                  {isChatLoading ? (
                    <div className="flex-1 flex items-center justify-center h-32">
                      <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {messages.map((msg) => (
                        <MessageItem
                          key={msg.id}
                          msg={msg}
                          onReply={() => setReplyTarget(msg)}
                          onEdit={async (messageId, content) => {
                            await editMessage({ messageId, content });
                          }}
                          onDelete={async (messageId) => {
                            await deleteMessage(messageId);
                          }}
                          onAddReaction={async (messageId, emoji) => {
                            await addReaction({ messageId, emoji });
                          }}
                          onRemoveReaction={async (messageId, emoji) => {
                            await removeReaction({ messageId, emoji });
                          }}
                          canManageMessages={canManageMessages}
                          canAddReactions={canAddReactions}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Floating Scroll to Bottom Indicator */}
                {showScrollBottomBtn && (
                  <button
                    onClick={() => scrollToBottom("smooth")}
                    className="absolute bottom-16 right-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-2 shadow-md border border-indigo-500 flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 z-20"
                    title="Scroll to bottom"
                    aria-label="Scroll to bottom"
                  >
                    <X className="h-3.5 w-3.5 rotate-45" />
                  </button>
                )}

                {/* Message Composer & Reply Target Bar */}
                <div className="shrink-0 bg-bg-secondary z-10 px-3 pb-3">
                  {replyTarget && (
                    <div className="bg-bg-tertiary border border-border-custom border-b-0 rounded-t px-3 py-1 flex items-center justify-between text-[10px] text-text-secondary">
                      <div className="flex items-center gap-1 truncate">
                        <span>Replying to</span>
                        <span className="font-semibold text-text-primary">
                          @{replyTarget.author.username}
                        </span>
                        <span className="truncate italic">"{replyTarget.content}"</span>
                      </div>
                      <button
                        onClick={() => setReplyTarget(null)}
                        className="text-text-muted hover:text-text-primary p-0.5 rounded cursor-pointer"
                        aria-label="Cancel reply"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  <div className="relative">
                    <TypingIndicator channelId={activeChannelId} />
                    <MessageComposer
                      channelId={activeChannelId}
                      placeholder="Message call chat..."
                      onSend={handleSendChat}
                      draftKey={`voice-chat-${activeChannelId}`}
                      permissions={channel?.permissions}
                      isDM={false}
                      guildId={activeGuildId || undefined}
                    />
                  </div>
                </div>
              </div>
            )}

            {activePanel === "participants" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
                {sortedParticipants.map((p) => (
                  <ParticipantTile
                    key={p.user_id}
                    participant={p}
                    channelId={activeChannelId}
                    compact
                    isPinned={pinnedIds.includes(`${p.user_id}-camera`)}
                    onPinToggle={() => handlePinToggle(`${p.user_id}-camera`)}
                    onFocusToggle={() => setFocusedId(`${p.user_id}-camera`)}
                    canMuteMembers={canMuteMembers}
                    canDeafenMembers={canDeafenMembers}
                    canMoveMembers={canMoveMembers}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
