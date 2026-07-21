"use client";

import React, { useEffect, useRef } from "react";
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
  Shield,
} from "lucide-react";
import { ConnectionState } from "livekit-client";
import { useVoice } from "../../features/voice/useVoice";

interface VoiceConnectionProps {
  channelName: string;
}

interface RemoteAudioPlayerProps {
  track: { attach: (el: HTMLAudioElement) => void; detach: (el: HTMLAudioElement) => void } | null;
  muted: boolean;
}

function RemoteAudioPlayer({ track, muted }: RemoteAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const element = audioRef.current;
    if (!track || !element) return;
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);

  useEffect(() => {
    if (!track) return;
    const audioTrack = track as unknown as { setVolume?: (v: number) => void };
    if (typeof audioTrack.setVolume !== "function") return;
    try {
      audioTrack.setVolume(muted ? 0.0 : 1.0);
    } catch (err) {
      console.warn("[Voice] Failed to adjust track volume:", err);
    }
  }, [track, muted]);

  return <audio ref={audioRef} autoPlay muted={muted} />;
}

/**
 * Compact voice connection status bar shown at the bottom of the channel sidebar.
 * Wired to the real LiveKit session via useVoice.
 */
export default function VoiceConnection({ channelName }: VoiceConnectionProps) {
  const {
    connectionState,
    selfState,
    participants,
    toggleMute,
    toggleDeafen,
    toggleVideo,
    toggleScreenShare,
    leaveVoice,
  } = useVoice();

  const isConnected = connectionState === ConnectionState.Connected;
  const isReconnecting = connectionState === ConnectionState.Reconnecting;

  const isMuted = selfState?.self_mute ?? false;
  const isDeafened = selfState?.self_deaf ?? false;
  const isVideo = selfState?.video ?? false;
  const isScreen = selfState?.screen_share ?? false;
  const serverMuted = selfState?.server_mute ?? false;
  const serverDeafened = selfState?.server_deaf ?? false;

  const participantArray = Array.from(participants.values());

  return (
    <div
      className="bg-bg-tertiary border-t border-border-custom px-3 py-2 flex flex-col gap-1.5 shrink-0 z-10 select-none"
      role="region"
      aria-label="Voice connection status"
    >
      {/* Global Audio Tracks Player */}
      {participantArray
        .filter((p) => p.user_id !== selfState?.user_id)
        .flatMap((p) => {
          const tracks = [];
          if (p.audioTrack) tracks.push({ key: `${p.user_id}-mic`, track: p.audioTrack });
          if (p.screenShareAudioTrack)
            tracks.push({ key: `${p.user_id}-ss`, track: p.screenShareAudioTrack });
          return tracks;
        })
        .map((item) => (
          <RemoteAudioPlayer
            key={item.key}
            track={item.track}
            muted={isDeafened || serverDeafened}
          />
        ))}

      {/* Connection status row */}
      <div className="flex items-center justify-between text-xs">
        <div
          className={`flex items-center gap-1.5 font-semibold ${
            isReconnecting ? "text-yellow-400" : isConnected ? "text-green-500" : "text-text-muted"
          }`}
        >
          {isReconnecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isConnected ? (
            <Wifi className="h-3.5 w-3.5" />
          ) : (
            <WifiOff className="h-3.5 w-3.5" />
          )}
          <span>
            {isReconnecting ? "Reconnecting..." : isConnected ? "Voice Connected" : "Connecting..."}
          </span>
        </div>
      </div>

      {/* Channel name */}
      <div className="text-xs text-text-secondary truncate font-medium">{channelName}</div>

      {/* Server-mute/deaf warning */}
      {(serverMuted || serverDeafened) && (
        <div className="flex items-center gap-1 text-[10px] text-red-400">
          <Shield className="h-3 w-3" />
          <span>
            {serverMuted && serverDeafened
              ? "Server muted and deafened"
              : serverMuted
                ? "Server muted"
                : "Server deafened"}
          </span>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between mt-1 px-1 gap-1">
        {/* Mute */}
        <button
          onClick={toggleMute}
          disabled={serverMuted}
          title={serverMuted ? "Server muted by a moderator" : isMuted ? "Unmute" : "Mute"}
          className={`p-2 rounded transition-all duration-200 ${
            serverMuted
              ? "bg-red-500/10 text-red-400 cursor-not-allowed opacity-60"
              : isMuted
                ? "bg-red-500/15 text-red-500 hover:bg-red-500/25 cursor-pointer"
                : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 cursor-pointer"
          }`}
          aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
        >
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>

        {/* Deafen */}
        <button
          onClick={toggleDeafen}
          disabled={serverDeafened}
          title={
            serverDeafened ? "Server deafened by a moderator" : isDeafened ? "Undeafen" : "Deafen"
          }
          className={`p-2 rounded transition-all duration-200 ${
            serverDeafened
              ? "bg-red-500/10 text-red-400 cursor-not-allowed opacity-60"
              : isDeafened
                ? "bg-red-500/15 text-red-500 hover:bg-red-500/25 cursor-pointer"
                : "bg-bg-secondary text-text-secondary hover:bg-bg-primary hover:text-text-primary cursor-pointer"
          }`}
          aria-label={isDeafened ? "Undeafen" : "Deafen"}
        >
          {isDeafened ? <HeadphoneOff className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
        </button>

        {/* Video */}
        <button
          onClick={toggleVideo}
          title={isVideo ? "Stop Video" : "Start Video"}
          className={`p-2 rounded transition-all duration-200 ${
            isVideo
              ? "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 cursor-pointer"
              : "bg-bg-secondary text-text-secondary hover:bg-bg-primary hover:text-text-primary cursor-pointer"
          }`}
          aria-label={isVideo ? "Stop video" : "Start video"}
        >
          {isVideo ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </button>

        {/* Screen Share */}
        <button
          onClick={toggleScreenShare}
          title={isScreen ? "Stop Sharing" : "Share Screen"}
          className={`p-2 rounded transition-all duration-200 ${
            isScreen
              ? "bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 cursor-pointer"
              : "bg-bg-secondary text-text-secondary hover:bg-bg-primary hover:text-text-primary cursor-pointer"
          }`}
          aria-label={isScreen ? "Stop screen sharing" : "Share screen"}
        >
          {isScreen ? <Monitor className="h-4 w-4" /> : <MonitorOff className="h-4 w-4" />}
        </button>

        <div className="w-px h-5 bg-border-custom mx-1" />

        {/* Disconnect */}
        <button
          onClick={leaveVoice}
          title="Disconnect from Channel"
          className="p-2 rounded bg-red-500 text-white hover:bg-red-600 transition-colors cursor-pointer"
          aria-label="Disconnect"
        >
          <PhoneOff className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
