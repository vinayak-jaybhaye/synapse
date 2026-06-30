"use client";

import React, { useState, useEffect } from "react";
import { useGuildStore } from "../../store/guild-store";
import { useChannelStore } from "../../store/channel-store";
import { useUIStore } from "../../store/ui-store";
import { useAuthStore } from "../../store/auth-store";
import { getMediaUrl } from "../../lib/media";
import { useGuilds } from "../../services/query/useGuilds";
import { useChannels } from "../../services/query/useChannels";
import { useDMs } from "../../services/query/useDMs";
import { useChannelPermissions, useGuildPermissions } from "../../hooks/usePermissions";
import {
  Hash,
  Volume2,
  Lock,
  ChevronDown,
  Plus,
  Settings,
  UserPlus,
  MessageSquare,
  Mic,
  MicOff,
  Headphones,
  Calendar,
  ChevronRight,
  ArrowLeft,
  X,
  Video,
} from "lucide-react";
import VoiceConnection from "../voice/VoiceConnection";
import VoiceParticipantsList from "../voice/VoiceParticipantsList";
import { useVoice } from "../../features/voice/useVoice";
import { useVoiceStore } from "../../features/voice/voiceStore";

function ChannelItem({
  ch,
  activeChannelId,
  handleChannelSelect,
  setActiveChannelSettingsId,
  setShowChannelSettings,
}: any) {
  const { canViewChannel, canManageChannels } = useChannelPermissions(ch.permissions);
  const activeVoiceChannelId = useVoiceStore((s) => s.activeChannelId);

  if (!canViewChannel && ch.id !== "private-placeholder") return null;

  const isActive = activeChannelId === ch.id;
  const isVoiceJoined = activeVoiceChannelId === ch.id;

  return (
    <>
      <button
        onClick={() => handleChannelSelect(ch.id, ch.type)}
        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm text-left transition-colors cursor-pointer group ${
          isActive || isVoiceJoined
            ? "bg-bg-primary text-text-primary font-semibold"
            : "text-text-secondary hover:bg-bg-primary/40 hover:text-text-primary"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {ch.type === 0 ? (
            <Hash className="h-4 w-4 shrink-0 text-text-muted" />
          ) : (
            <Volume2
              className={`h-4 w-4 shrink-0 ${isVoiceJoined ? "text-green-500" : "text-text-muted"}`}
            />
          )}
          <span className="truncate">{ch.name}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
          {ch.id === "private-placeholder" ? <Lock className="h-3 w-3 text-text-muted" /> : null}
          {canManageChannels && (
            <Settings
              className="h-3.5 w-3.5 text-text-muted hover:text-text-primary cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setActiveChannelSettingsId(ch.id);
                setShowChannelSettings(true);
              }}
            />
          )}
        </div>
      </button>
      {/* Show connected participants under voice channels */}
      {ch.type === 1 && <VoiceParticipantsList channelId={ch.id} channelName={ch.name} />}
    </>
  );
}

interface ChannelSidebarProps {
  onChannelClick?: () => void;
}

export default function ChannelSidebar({ onChannelClick }: ChannelSidebarProps = {}) {
  const { guilds } = useGuilds();
  const { activeGuildId } = useGuildStore();
  const { activeChannelId, selectChannel } = useChannelStore();
  const {
    setShowCreateChannel,
    setShowSettings,
    setSettingsTab,
    setShowGuildSettings,
    setGuildSettingsTab,
    setShowCreateDM,
    setShowInviteModal,
    setShowChannelSettings,
    setActiveChannelSettingsId,
  } = useUIStore();
  const { user } = useAuthStore();

  const { channels, createChannel } = useChannels(activeGuildId || undefined);
  const { dms } = useDMs();
  const safeDMs = dms || [];

  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Real voice state from LiveKit integration
  const { joinVoice, leaveVoice, toggleMute, toggleDeafen } = useVoice();
  const activeVoiceChannelId = useVoiceStore((s) => s.activeChannelId);
  const activeVoiceGuildId = useVoiceStore((s) => s.activeGuildId);
  const selfState = useVoiceStore((s) => s.selfState);
  const { room } = useVoiceStore();

  // Device settings states
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);

  const [selectedMic, setSelectedMic] = useState<string>("");
  const [selectedCam, setSelectedCam] = useState<string>("");
  const [selectedSpk, setSelectedSpk] = useState<string>("");

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
      try {
        await room.switchActiveDevice("audioinput", deviceId);
      } catch (err) {
        console.error("[Voice] Failed to switch microphone input device:", err);
      }
    }
  };

  const handleCamChange = async (deviceId: string) => {
    setSelectedCam(deviceId);
    if (room) {
      try {
        await room.switchActiveDevice("videoinput", deviceId);
      } catch (err) {
        console.error("[Voice] Failed to switch video camera input device:", err);
      }
    }
  };

  const handleSpkChange = async (deviceId: string) => {
    setSelectedSpk(deviceId);
    if (room) {
      try {
        await room.switchActiveDevice("audiooutput", deviceId);
      } catch (err) {
        console.error("[Voice] Failed to switch audio output speaker device:", err);
      }
    }
  };

  const activeGuild = guilds.find((g) => g.id === activeGuildId);
  const { canManageChannels: canManageGuildChannels } = useGuildPermissions(
    activeGuild?.permissions,
  );
  const { canManageGuild, canCreateInstantInvite } = useGuildPermissions(activeGuild?.permissions);

  const toggleCategory = (catId: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const handleChannelSelect = (channelId: string, type: number) => {
    if (type === 1) {
      if (activeVoiceChannelId !== channelId) {
        joinVoice(activeGuildId!, channelId);
      }
      selectChannel(channelId);
    } else {
      selectChannel(channelId);
    }
    onChannelClick?.();
  };

  // Group channels by category
  const categories = channels.filter((c) => c.type === 2); // Category type = 2
  const textChannels = channels.filter((c) => c.type === 0 && !c.parent_channel_id);
  const voiceChannels = channels.filter((c) => c.type === 1 && !c.parent_channel_id);

  const getChannelsInCategory = (catId: string) => {
    return channels.filter((c) => c.parent_channel_id === catId);
  };

  return (
    <div className="flex flex-col h-full w-full bg-bg-secondary select-none">
      {/* 1. Sidebar Header */}
      <div
        className={`relative border-b border-border-custom px-4 flex items-end shrink-0 shadow-sm transition-all duration-300 overflow-hidden ${
          activeGuild?.banner_key ? "h-32" : "h-12"
        }`}
        style={
          activeGuild?.banner_key
            ? {
                backgroundImage: `url(${getMediaUrl(activeGuild.banner_key)})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {activeGuild?.banner_key && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/40 z-0 pointer-events-none" />
        )}
        <div className="relative z-10 w-full flex items-center justify-between h-12 pb-1">
          {activeGuild ? (
            <>
              <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                {onChannelClick && (
                  <button
                    onClick={onChannelClick}
                    className="p-1 hover:bg-white/10 rounded text-text-secondary hover:text-text-primary transition-colors cursor-pointer shrink-0"
                    title="Back to Chat"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <span className="font-bold text-text-primary truncate drop-shadow-md">
                  {activeGuild.name}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {canCreateInstantInvite && (
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="p-1 hover:bg-bg-tertiary/60 rounded text-text-secondary hover:text-text-primary backdrop-blur-sm transition-colors cursor-pointer"
                    title="Invite People"
                  >
                    <UserPlus className="h-4 w-4" />
                  </button>
                )}
                {canManageGuildChannels && (
                  <button
                    onClick={() => setShowCreateChannel(true)}
                    className="p-1 hover:bg-bg-tertiary/60 rounded text-text-secondary hover:text-text-primary backdrop-blur-sm transition-colors cursor-pointer"
                    title="Create Channel"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
                {canManageGuild && (
                  <button
                    onClick={() => {
                      setGuildSettingsTab("roles");
                      setShowGuildSettings(true);
                    }}
                    className="p-1 hover:bg-bg-tertiary/60 rounded text-text-secondary hover:text-text-primary backdrop-blur-sm transition-colors cursor-pointer"
                    title="Server Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              {onChannelClick && (
                <button
                  onClick={onChannelClick}
                  className="p-1 hover:bg-white/10 rounded text-text-secondary hover:text-text-primary transition-colors cursor-pointer shrink-0"
                  title="Back to Chat"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <span className="font-bold text-text-primary">Direct Messages</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Channel & Categories List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {activeGuild ? (
          <>
            {/* Future Placeholder extension points: Events */}
            <div className="px-2 py-1 flex items-center justify-between text-text-muted hover:text-text-primary cursor-pointer text-xs font-semibold uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                <span>Events</span>
              </div>
              <span className="bg-bg-tertiary px-1.5 py-0.5 rounded text-[10px]">0</span>
            </div>

            {channels.length === 0 && (
              <div className="flex flex-col items-center justify-center p-4 mt-4 text-center bg-bg-primary/50 rounded-lg border border-border-custom/50 mx-2">
                <Hash className="h-8 w-8 text-text-muted mb-2" />
                <h3 className="text-text-primary font-medium text-sm">No Channels</h3>
                <p className="text-text-muted text-xs mt-1 mb-3">
                  Get the conversation started by creating a channel.
                </p>
                <button
                  onClick={() => setShowCreateChannel(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                >
                  Create Channel
                </button>
              </div>
            )}

            {/* Uncategorized text/voice channels */}
            {textChannels.length > 0 && (
              <div>
                <div className="flex items-center justify-between text-text-muted text-[11px] font-bold uppercase tracking-wider px-2 mb-1">
                  <span>Text Channels</span>
                  <Plus
                    className="h-3.5 w-3.5 hover:text-text-primary cursor-pointer"
                    onClick={() => {
                      setShowCreateChannel(true);
                    }}
                  />
                </div>
                <div className="space-y-0.5">
                  {textChannels.map((ch) => (
                    <ChannelItem
                      key={ch.id}
                      ch={ch}
                      activeChannelId={activeChannelId}
                      handleChannelSelect={handleChannelSelect}
                      setActiveChannelSettingsId={setActiveChannelSettingsId}
                      setShowChannelSettings={setShowChannelSettings}
                    />
                  ))}
                </div>
              </div>
            )}

            {voiceChannels.length > 0 && (
              <div>
                <div className="flex items-center justify-between text-text-muted text-[11px] font-bold uppercase tracking-wider px-2 mb-1">
                  <span>Voice Channels</span>
                  <Plus
                    className="h-3.5 w-3.5 hover:text-text-primary cursor-pointer"
                    onClick={() => {
                      setShowCreateChannel(true);
                    }}
                  />
                </div>
                <div className="space-y-0.5">
                  {voiceChannels.map((ch) => (
                    <ChannelItem
                      key={ch.id}
                      ch={ch}
                      activeChannelId={activeChannelId}
                      handleChannelSelect={handleChannelSelect}
                      setActiveChannelSettingsId={setActiveChannelSettingsId}
                      setShowChannelSettings={setShowChannelSettings}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Categories */}
            {categories.map((cat) => {
              const isCollapsed = collapsedCategories[cat.id];
              const catChannels = getChannelsInCategory(cat.id);

              return (
                <div key={cat.id} className="space-y-1">
                  <div className="flex items-center justify-between px-1 text-text-muted text-[11px] font-bold uppercase tracking-wider">
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      className="flex items-center gap-1 hover:text-text-primary text-left cursor-pointer"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3 w-3 shrink-0" />
                      ) : (
                        <ChevronDown className="h-3 w-3 shrink-0" />
                      )}
                      <span className="truncate">{cat.name}</span>
                    </button>
                    <Plus
                      className="h-3.5 w-3.5 hover:text-text-primary cursor-pointer"
                      onClick={() => {
                        setShowCreateChannel(true);
                      }}
                    />
                  </div>

                  {!isCollapsed && (
                    <div className="pl-2 space-y-0.5">
                      {catChannels.map((ch) => (
                        <ChannelItem
                          key={ch.id}
                          ch={ch}
                          activeChannelId={activeChannelId}
                          handleChannelSelect={handleChannelSelect}
                          setActiveChannelSettingsId={setActiveChannelSettingsId}
                          setShowChannelSettings={setShowChannelSettings}
                        />
                      ))}
                      {catChannels.length === 0 && (
                        <span className="text-text-muted/65 text-xs italic pl-6 block py-0.5">
                          Empty category
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          /* Direct Messages View */
          <div className="space-y-2">
            <div className="flex items-center justify-between text-text-muted text-xxs font-bold uppercase tracking-wider px-2">
              <span className="select-none">Direct Messages</span>
              <Plus
                className="h-3.5 w-3.5 hover:text-text-primary cursor-pointer"
                onClick={() => setShowCreateDM(true)}
              />
            </div>

            <button
              onClick={() => {
                selectChannel(null);
                onChannelClick?.();
              }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors cursor-pointer ${
                activeChannelId === null
                  ? "bg-bg-primary text-text-primary font-semibold"
                  : "text-text-secondary hover:bg-bg-primary/45 hover:text-text-primary"
              }`}
            >
              <MessageSquare className="h-4 w-4 text-text-muted" />
              <span>Synapse Welcome</span>
            </button>

            {/* Active DM list */}
            {safeDMs.length > 0 && (
              <div className="pt-2 space-y-0.5">
                {safeDMs.map((dm) => {
                  const isActive = activeChannelId === dm.channel_id;
                  const initials = dm.recipient.username
                    ? dm.recipient.username.substring(0, 1).toUpperCase()
                    : "U";

                  return (
                    <button
                      key={dm.channel_id}
                      onClick={() => {
                        selectChannel(dm.channel_id);
                        onChannelClick?.();
                      }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors cursor-pointer group ${
                        isActive
                          ? "bg-bg-primary text-text-primary font-semibold"
                          : "text-text-secondary hover:bg-bg-primary/40 hover:text-text-primary"
                      }`}
                    >
                      <div className="relative shrink-0 h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-white text-xs select-none overflow-hidden">
                        {dm.recipient.avatar_key ? (
                          <img
                            src={getMediaUrl(dm.recipient.avatar_key)}
                            alt={dm.recipient.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          initials
                        )}
                        <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-emerald-500 border-[2px] border-bg-tertiary rounded-full" />
                      </div>
                      <span className="truncate">
                        {dm.recipient.display_name || dm.recipient.username}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {safeDMs.length === 0 && (
              <div className="pt-4 px-2">
                <span className="text-text-muted text-[11px] block select-none">
                  Start a conversation by sending a direct message.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Voice Connection State (shown when in a voice channel in this guild) */}
      {activeVoiceChannelId && activeVoiceGuildId === activeGuildId && (
        <VoiceConnection
          channelName={channels.find((c) => c.id === activeVoiceChannelId)?.name || "Voice Channel"}
        />
      )}

      {/* 4. User settings bar profile footer */}
      <div className="h-14 bg-bg-tertiary border-t border-border-custom px-2.5 flex items-center justify-between shrink-0">
        <div className="flex flex-col min-w-0 max-w-[130px] overflow-hidden">
          <span className="text-sm font-semibold text-text-primary truncate">
            {user?.username || "Guest User"}
          </span>
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full shrink-0" />
            <span className="text-[10px] text-text-muted truncate">Online</span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={toggleMute}
            className="p-1.5 hover:bg-bg-secondary rounded text-text-secondary hover:text-text-primary cursor-pointer"
            title={selfState?.self_mute ? "Unmute Mic" : "Mute Mic"}
          >
            {selfState?.self_mute ? (
              <MicOff className="h-4 w-4 text-red-500" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>

          <button
            onClick={toggleDeafen}
            className="p-1.5 hover:bg-bg-secondary rounded text-text-secondary hover:text-text-primary cursor-pointer"
            title={selfState?.self_deaf ? "Undeafen Audio" : "Deafen Audio"}
          >
            <Headphones className={`h-4 w-4 ${selfState?.self_deaf ? "text-red-500" : ""}`} />
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 hover:bg-bg-secondary rounded text-text-secondary hover:text-text-primary cursor-pointer"
            title="User Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Device Settings Modal Panel */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200 p-4">
          <div className="w-full max-w-sm bg-bg-secondary/95 border border-white/10 rounded-xl shadow-2xl p-6 relative select-none backdrop-blur-md animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded-md text-text-secondary hover:text-text-primary transition-all duration-200 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="font-bold text-base text-text-primary mb-4 flex items-center gap-2">
              <Settings className="h-5 w-5 text-indigo-400 animate-spin-slow" />
              <span>Voice & Video Settings</span>
            </h3>

            <div className="space-y-4 border-t border-white/10 pt-4">
              {/* Camera select */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <Video className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Video Camera</span>
                </label>
                <select
                  value={selectedCam}
                  onChange={(e) => handleCamChange(e.target.value)}
                  className="w-full bg-bg-tertiary border border-border-custom hover:border-indigo-500/50 rounded-md px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors shadow-inner cursor-pointer"
                >
                  <option value="">Default Camera</option>
                  {videoInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera ${d.deviceId.substring(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Microphone select */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <Mic className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Microphone Input</span>
                </label>
                <select
                  value={selectedMic}
                  onChange={(e) => handleMicChange(e.target.value)}
                  className="w-full bg-bg-tertiary border border-border-custom hover:border-indigo-500/50 rounded-md px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors shadow-inner cursor-pointer"
                >
                  <option value="">Default Microphone</option>
                  {audioInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Mic ${d.deviceId.substring(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Speaker select */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <Volume2 className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Audio Output (Speaker)</span>
                </label>
                <select
                  value={selectedSpk}
                  onChange={(e) => handleSpkChange(e.target.value)}
                  className="w-full bg-bg-tertiary border border-border-custom hover:border-indigo-500/50 rounded-md px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors shadow-inner cursor-pointer"
                >
                  <option value="">Default Speaker</option>
                  {audioOutputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Speaker ${d.deviceId.substring(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
