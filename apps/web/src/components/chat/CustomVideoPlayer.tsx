"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";

interface CustomVideoPlayerProps {
  src: string;
  autoPlay?: boolean;
  className?: string;
  /** Max height CSS class for constrained mode (e.g., in chat) */
  maxHeightClass?: string;
}

export default function CustomVideoPlayer({
  src,
  autoPlay = false,
  className = "",
  maxHeightClass = "max-h-[350px]",
}: CustomVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffered, setBuffered] = useState(0);

  // Play / Pause
  const togglePlay = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play();
    } else {
      vid.pause();
    }
  }, []);

  // Volume
  const toggleMute = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !vid.muted;
    setIsMuted(vid.muted);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vid = videoRef.current;
    if (!vid) return;
    const val = parseFloat(e.target.value);
    vid.volume = val;
    vid.muted = val === 0;
    setVolume(val);
    setIsMuted(val === 0);
  }, []);

  // Fullscreen (within the app — uses the container div)
  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await container.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Progress seek
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const vid = videoRef.current;
    const bar = progressRef.current;
    if (!vid || !bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    vid.currentTime = pct * vid.duration;
  }, []);

  // Video event listeners
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(vid.currentTime);
    const onDurationChange = () => setDuration(vid.duration);
    const onProgress = () => {
      if (vid.buffered.length > 0) {
        setBuffered(vid.buffered.end(vid.buffered.length - 1));
      }
    };

    vid.addEventListener("play", onPlay);
    vid.addEventListener("pause", onPause);
    vid.addEventListener("timeupdate", onTimeUpdate);
    vid.addEventListener("durationchange", onDurationChange);
    vid.addEventListener("progress", onProgress);

    return () => {
      vid.removeEventListener("play", onPlay);
      vid.removeEventListener("pause", onPause);
      vid.removeEventListener("timeupdate", onTimeUpdate);
      vid.removeEventListener("durationchange", onDurationChange);
      vid.removeEventListener("progress", onProgress);
    };
  }, []);

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
      }
    }, 3000);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle when this player's container is focused or in fullscreen
      if (!containerRef.current?.contains(document.activeElement) && !isFullscreen) return;

      // Don't capture keys when typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const vid = videoRef.current;
      if (!vid) return;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "m":
          toggleMute();
          break;
        case "f":
          toggleFullscreen();
          break;
        case "ArrowLeft":
          e.preventDefault();
          vid.currentTime = Math.max(0, vid.currentTime - 5);
          break;
        case "ArrowRight":
          e.preventDefault();
          vid.currentTime = Math.min(vid.duration, vid.currentTime + 5);
          break;
        case "ArrowUp":
          e.preventDefault();
          vid.volume = Math.min(1, vid.volume + 0.1);
          setVolume(vid.volume);
          break;
        case "ArrowDown":
          e.preventDefault();
          vid.volume = Math.max(0, vid.volume - 0.1);
          setVolume(vid.volume);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, togglePlay, toggleMute, toggleFullscreen]);

  // Prevent right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Format time
  const formatTime = (sec: number) => {
    if (!isFinite(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={`relative group bg-black select-none ${
        isFullscreen
          ? "w-screen h-screen flex items-center justify-center"
          : `rounded-lg overflow-hidden inline-block ${maxHeightClass}`
      } ${className}`}
      onMouseMove={resetControlsTimer}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false);
      }}
      onContextMenu={handleContextMenu}
      tabIndex={0}
    >
      {/* Video Element — no native controls */}
      <video
        ref={videoRef}
        src={src}
        autoPlay={autoPlay}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        className={`${
          isFullscreen ? "max-w-full max-h-full" : `w-auto max-w-full ${maxHeightClass}`
        } object-contain cursor-pointer`}
        playsInline
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
        onContextMenu={handleContextMenu}
      />

      {/* Big center play button when paused */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity cursor-pointer"
        >
          <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Play className="h-7 w-7 text-white ml-1" fill="white" />
          </div>
        </button>
      )}

      {/* Bottom Controls Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-8 pb-2 px-3 transition-opacity duration-300 ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="relative w-full h-1 bg-white/20 rounded-full cursor-pointer mb-2.5 group/progress hover:h-1.5 transition-all overflow-hidden z-10"
          onClick={handleProgressClick}
        >
          {/* Buffered */}
          <div
            className="absolute inset-y-0 left-0 bg-white/20 rounded-full"
            style={{ width: `${bufferedPct}%` }}
          />
          {/* Played */}
          <div
            className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="text-white hover:text-indigo-300 transition-colors cursor-pointer"
              title={isPlaying ? "Pause (k)" : "Play (k)"}
            >
              {isPlaying ? (
                <Pause className="h-4.5 w-4.5" fill="white" />
              ) : (
                <Play className="h-4.5 w-4.5" fill="white" />
              )}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1.5 group/vol">
              <button
                onClick={toggleMute}
                className="text-white hover:text-indigo-300 transition-colors cursor-pointer"
                title={isMuted ? "Unmute (m)" : "Mute (m)"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-0 group-hover/vol:w-16 transition-all duration-200 accent-indigo-500 h-1 cursor-pointer opacity-0 group-hover/vol:opacity-100"
              />
            </div>

            {/* Time */}
            <span className="text-white/70 text-[11px] font-mono tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="text-white hover:text-indigo-300 transition-colors cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen (f)" : "Fullscreen (f)"}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
