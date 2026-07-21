/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Headphones, HeadphoneOff, PhoneOff, Maximize2 } from "lucide-react";
import { useVoice } from "../../features/voice/useVoice";
import { useChannelStore } from "../../store/channel-store";
import { useGuildStore } from "../../store/guild-store";
import { useChannels } from "../../services/query/useChannels";
import { getMediaUrl } from "../../lib/media";

const BUBBLE_WIDTH = 280; // Width of the bubble
const BUBBLE_HEIGHT = 120; // Height of the bubble
const MARGIN = 12; // Gap distance to preserve near screen edges

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

  const [isMobile, setIsMobile] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const posStartRef = useRef({ x: 0, y: 0 });

  // Handle screen resizing, mobile breakpoint checks, and snapping position updates
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      if (mobile) {
        setPosition((currentPos) => {
          const screenW = window.innerWidth;
          const screenH = window.innerHeight;

          const defaultX = screenW - BUBBLE_WIDTH - MARGIN;
          const defaultY = screenH - BUBBLE_HEIGHT - MARGIN;

          if (!currentPos) {
            return { x: defaultX, y: defaultY };
          }

          // Settle bubble at the closest viewport corner
          const corners = [
            { x: MARGIN, y: MARGIN }, // Top-Left
            { x: screenW - BUBBLE_WIDTH - MARGIN, y: MARGIN }, // Top-Right
            { x: MARGIN, y: screenH - BUBBLE_HEIGHT - MARGIN }, // Bottom-Left
            {
              x: screenW - BUBBLE_WIDTH - MARGIN,
              y: screenH - BUBBLE_HEIGHT - MARGIN,
            }, // Bottom-Right
          ];

          let closestCorner = corners[3];
          let minDistance = Infinity;

          corners.forEach((corner) => {
            const dx = currentPos.x - corner.x;
            const dy = currentPos.y - corner.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDistance) {
              minDistance = dist;
              closestCorner = corner;
            }
          });

          return closestCorner;
        });
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Global drag gesture listeners
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (clientX: number, clientY: number) => {
      if (!position) return;
      const deltaX = clientX - dragStartRef.current.x;
      const deltaY = clientY - dragStartRef.current.y;

      // Restrict dragging boundaries within the viewport margins
      const newX = Math.max(
        MARGIN,
        Math.min(window.innerWidth - BUBBLE_WIDTH - MARGIN, posStartRef.current.x + deltaX),
      );
      const newY = Math.max(
        MARGIN,
        Math.min(window.innerHeight - BUBBLE_HEIGHT - MARGIN, posStartRef.current.y + deltaY),
      );

      setPosition({ x: newX, y: newY });
    };

    const onMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    const onEnd = () => {
      setIsDragging(false);

      // Snap bubble to closest viewport corner on release
      setPosition((currentPos) => {
        if (!currentPos) return null;
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;

        const corners = [
          { x: MARGIN, y: MARGIN },
          { x: screenW - BUBBLE_WIDTH - MARGIN, y: MARGIN },
          { x: MARGIN, y: screenH - BUBBLE_HEIGHT - MARGIN },
          {
            x: screenW - BUBBLE_WIDTH - MARGIN,
            y: screenH - BUBBLE_HEIGHT - MARGIN,
          },
        ];

        let closestCorner = corners[3];
        let minDistance = Infinity;

        corners.forEach((corner) => {
          const dx = currentPos.x - corner.x;
          const dy = currentPos.y - corner.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDistance) {
            minDistance = dist;
            closestCorner = corner;
          }
        });

        return closestCorner;
      });
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onEnd);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, [isDragging, position]);

  const handlePointerStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!position) return;
    setIsDragging(true);
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { x: clientX, y: clientY };
    posStartRef.current = { x: position.x, y: position.y };
  };

  // If not in a voice channel, viewing active voice channel details, or on desktop, return null
  if (!voiceChannelId || viewedChannelId === voiceChannelId || !isMobile) {
    return null;
  }

  const voiceChannel = channels.find((c) => c.id === voiceChannelId);
  const voiceChannelName = voiceChannel?.name || "Voice Channel";

  const participantArray = Array.from(participants.values());

  const handleMaximize = () => {
    selectChannel(voiceChannelId);
  };

  const isMuted = selfState?.self_mute ?? false;
  const isDeafened = selfState?.self_deaf ?? false;
  const serverMuted = selfState?.server_mute ?? false;
  const serverDeafened = selfState?.server_deaf ?? false;

  return (
    <div
      style={
        position
          ? { left: `${position.x}px`, top: `${position.y}px` }
          : { bottom: "24px", right: "24px" }
      }
      className={`fixed z-50 w-[280px] bg-bg-secondary/95 border border-border-custom shadow-lg rounded-md overflow-hidden ${isDragging ? "" : "transition-all duration-300 ease-out"}`}
    >
      {/* Top Header (Draggable Handle) */}
      <div
        onMouseDown={handlePointerStart}
        onTouchStart={handlePointerStart}
        className="flex items-center justify-between px-3 py-2 bg-bg-tertiary/50 border-b border-border-custom/50 cursor-move select-none"
      >
        <div className="flex flex-col min-w-0 pointer-events-none">
          <span className="text-[9px] text-text-muted uppercase tracking-wider font-bold">
            Voice Connected
          </span>
          <span className="text-xs font-semibold text-text-primary truncate">
            {voiceChannelName}
          </span>
        </div>
        <button
          onClick={handleMaximize}
          className="p-1 hover:bg-bg-tertiary rounded text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          title="Open fullscreen voice grid"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Speaking Active Speakers List */}
      <div className="px-3 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none">
        {participantArray.slice(0, 5).map((p) => {
          const displayName = p.display_name || p.username || p.user_id;
          const initials = displayName.substring(0, 2).toUpperCase();
          return (
            <div key={p.user_id} className="relative group shrink-0" title={displayName}>
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white transition-all duration-200 ${
                  p.speaking
                    ? "ring-2 ring-emerald-500 ring-offset-1 ring-offset-bg-secondary"
                    : "bg-indigo-600"
                }`}
              >
                {p.avatar_key ? (
                  <img
                    src={getMediaUrl(p.avatar_key)}
                    className="w-full h-full rounded-full object-cover"
                    alt=""
                  />
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
          <div className="h-8 w-8 rounded-full bg-bg-tertiary flex items-center justify-center text-xs font-bold text-text-muted border border-border-custom">
            +{participantArray.length - 5}
          </div>
        )}

        {participantArray.length === 0 && (
          <span className="text-xs text-text-muted italic">No speakers...</span>
        )}
      </div>

      {/* Control Buttons */}
      <div className="px-3 py-2 bg-bg-tertiary/20 flex items-center justify-between border-t border-border-custom/50">
        <div className="flex items-center gap-1">
          {/* Mute */}
          <button
            onClick={toggleMute}
            disabled={serverMuted}
            title={serverMuted ? "Server Muted" : isMuted ? "Unmute" : "Mute"}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              serverMuted
                ? "text-red-400 opacity-60"
                : isMuted
                  ? "text-red-400 bg-red-500/10 hover:bg-red-500/20"
                  : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            }`}
          >
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          {/* Deafen */}
          <button
            onClick={toggleDeafen}
            disabled={serverDeafened}
            title={serverDeafened ? "Server Deafened" : isDeafened ? "Undeafen" : "Deafen"}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              serverDeafened
                ? "text-red-400 opacity-60"
                : isDeafened
                  ? "text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20"
                  : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            }`}
          >
            {isDeafened ? <HeadphoneOff className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
          </button>
        </div>

        {/* Disconnect */}
        <button
          onClick={leaveVoice}
          title="Disconnect from Voice"
          className="p-1.5 bg-red-500 hover:bg-red-600 rounded text-white transition-colors cursor-pointer flex items-center justify-center"
        >
          <PhoneOff className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
