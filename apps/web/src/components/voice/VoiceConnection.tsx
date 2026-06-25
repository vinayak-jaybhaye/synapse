"use client";

import React, { useState } from "react";
import { PhoneOff, Video, Monitor, ShieldAlert, Wifi } from "lucide-react";
import { useChannelPermissions } from "../../hooks/usePermissions";

interface VoiceConnectionProps {
  channelName: string;
  onDisconnect: () => void;
  permissions?: string;
}

export default function VoiceConnection({ channelName, onDisconnect, permissions }: VoiceConnectionProps) {
  const { canSpeak } = useChannelPermissions(permissions);
  const [screenSharing, setScreenSharing] = useState(false);
  const [videoActive, setVideoActive] = useState(false);

  return (
    <div
      className="bg-bg-tertiary border-t border-border-custom px-3 py-2 flex flex-col gap-1.5 shrink-0 z-10"
      role="region"
      aria-label="Voice connection status"
    >
      {/* Upper row: connection state and wifi info */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-green-500 font-semibold">
          <Wifi className="h-4 w-4 animate-pulse" />
          <span>Voice Connected</span>
        </div>
        <span className="text-text-muted text-[10px]">24 ms</span>
      </div>

      {/* Middle row: voice channel metadata */}
      <div className="text-xs text-text-secondary truncate font-medium pl-5">
        {channelName}
      </div>

      {/* Action buttons (Mute/Video/Screen Share/Disconnect) */}
      <div className="flex items-center justify-between mt-1 px-1">
        <button
          onClick={() => setVideoActive(!videoActive)}
          className={`p-1.5 rounded transition-colors ${
            !canSpeak ? "opacity-50 cursor-not-allowed text-text-muted" :
            videoActive ? "text-green-500 hover:bg-bg-secondary" : "text-text-secondary hover:bg-bg-secondary hover:text-text-primary cursor-pointer"
          }`}
          disabled={!canSpeak}
          title={canSpeak ? "Toggle Video" : "You don't have permission to speak in this channel."}
          aria-label={videoActive ? "Turn off video" : "Turn on video"}
        >
          <Video className="h-4 w-4" />
        </button>

        <button
          onClick={() => setScreenSharing(!screenSharing)}
          className={`p-1.5 rounded transition-colors ${
            !canSpeak ? "opacity-50 cursor-not-allowed text-text-muted" :
            screenSharing ? "text-indigo-400 hover:bg-bg-secondary" : "text-text-secondary hover:bg-bg-secondary hover:text-text-primary cursor-pointer"
          }`}
          disabled={!canSpeak}
          title={canSpeak ? "Share Screen" : "You don't have permission to speak in this channel."}
          aria-label={screenSharing ? "Stop sharing screen" : "Share screen"}
        >
          <Monitor className="h-4 w-4" />
        </button>

        <button
          onClick={onDisconnect}
          className="p-1.5 bg-red-500 hover:bg-red-600 rounded text-white cursor-pointer"
          title="Disconnect from Voice"
          aria-label="Disconnect from Voice"
        >
          <PhoneOff className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
