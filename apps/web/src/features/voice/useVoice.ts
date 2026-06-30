"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  Room,
  RoomEvent,
  ConnectionState,
  DisconnectReason,
  RoomOptions,
  LocalParticipant,
  RemoteParticipant,
  Participant,
  Track,
  RemoteTrack,
  LocalTrack,
  RemoteAudioTrack,
  RemoteVideoTrack,
  LocalAudioTrack,
  LocalVideoTrack,
} from "livekit-client";
import { useChannelStore } from "../../store/channel-store";
import { useVoiceStore } from "./voiceStore";
import { useUIStore } from "../../store/ui-store";
import { joinVoiceChannel, leaveVoiceChannel } from "../../services/api/voice";

const HEARTBEAT_INTERVAL_MS = 30_000; // 30s
const TOKEN_REFRESH_BUFFER_S = 120; // refresh 2 min before expiry

// ─── Room Options ──────────────────────────────────────────────────────────────
const roomOptions: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  videoCaptureDefaults: {
    resolution: { width: 1280, height: 720, frameRate: 30 },
  },
};

// ─── Hook ──────────────────────────────────────────────────────────────────────
export function useVoice() {
  const store = useVoiceStore();
  const activeChannelIdRef = useRef<string | null>(null);

  // Helper to sync local/remote participant flags to Zustand store
  const syncParticipantState = useCallback(
    (participant: Participant) => {
      const userId = participant.identity;
      const self_mute = !participant.isMicrophoneEnabled;
      const video = participant.isCameraEnabled;
      const screen_share = participant.isScreenShareEnabled;

      const existing = useVoiceStore.getState().participants.get(userId);
      let self_deaf = existing?.self_deaf ?? false;
      let server_mute = existing?.server_mute ?? false;
      let server_deaf = existing?.server_deaf ?? false;

      if (participant.metadata) {
        try {
          const data = JSON.parse(participant.metadata);
          if (typeof data.self_deaf === "boolean") self_deaf = data.self_deaf;
          if (typeof data.server_mute === "boolean") server_mute = data.server_mute;
          if (typeof data.server_deaf === "boolean") server_deaf = data.server_deaf;
        } catch {}
      }

      // Extract tracks dynamically to ensure they are synchronized under all race conditions
      let videoTrack: any = undefined;
      let screenShareTrack: any = undefined;
      let audioTrack: any = undefined;
      let screenShareAudioTrack: any = undefined;

      participant.videoTrackPublications.forEach((pub) => {
        if (pub.track) {
          if (pub.source === Track.Source.ScreenShare) {
            screenShareTrack = pub.track;
          } else {
            videoTrack = pub.track;
          }
        }
      });

      participant.audioTrackPublications.forEach((pub) => {
        if (pub.track) {
          if (pub.source === Track.Source.ScreenShareAudio) {
            screenShareAudioTrack = pub.track;
          } else {
            audioTrack = pub.track;
          }
        }
      });

      store.setParticipant(userId, {
        self_mute,
        self_deaf,
        server_mute,
        server_deaf,
        video,
        screen_share,
        videoTrack,
        screenShareTrack,
        audioTrack,
        screenShareAudioTrack,
      });

      if (participant instanceof LocalParticipant) {
        store.setSelfState({
          user_id: userId,
          channel_id: store.activeChannelId ?? "",
          guild_id: store.activeGuildId ?? "",
          self_mute,
          self_deaf,
          server_mute,
          server_deaf,
          video,
          screen_share,
          joined_at: new Date().toISOString(),
        });
      }
    },
    [store],
  );

  // ── Join ────────────────────────────────────────────────────────────────────
  const joinVoice = useCallback(
    async (guildId: string, channelId: string) => {
      if (store.room) {
        await leaveVoice();
      }

      // 1. Obtain LiveKit token from backend
      const { livekit_url, token } = await joinVoiceChannel(channelId);

      // 2. Create room
      const room = new Room(roomOptions);
      store.setRoom(room);
      store.setActive(guildId, channelId);
      activeChannelIdRef.current = channelId;

      // 3. Attach event listeners before connecting
      attachRoomListeners(room, channelId, guildId);

      // 4. Connect
      await room.connect(livekit_url, token);

      // 5. Initial local participant sync
      syncParticipantState(room.localParticipant);
    },
    [store, syncParticipantState],
  );

  // ── Leave ───────────────────────────────────────────────────────────────────
  const leaveVoice = useCallback(async () => {
    const channelId = activeChannelIdRef.current;
    const room = store.room;

    activeChannelIdRef.current = null;
    room?.disconnect();
    store.clearActive();

    // Reset viewed channel if we were looking at the voice channel we're leaving
    const viewedChannelId = useChannelStore.getState().activeChannelId;
    if (viewedChannelId === channelId) {
      useChannelStore.getState().selectChannel(null);
    }

    if (channelId) {
      await leaveVoiceChannel(channelId).catch(() => {});
    }
  }, [store]);

  // ── Toggle Mic ──────────────────────────────────────────────────────────────
  const toggleMute = useCallback(async () => {
    const { room, selfState } = store;
    if (!room) return;

    // Block self-unmute if server-muted
    if (selfState?.server_mute && selfState.self_mute) {
      console.warn("[Voice] Cannot unmute: server-muted");
      return;
    }

    try {
      const isMuted = room.localParticipant.isMicrophoneEnabled === false;
      await room.localParticipant.setMicrophoneEnabled(isMuted);
    } catch (err) {
      console.error("[Voice] Failed to toggle microphone:", err);
    } finally {
      syncParticipantState(room.localParticipant);
    }
  }, [store, syncParticipantState]);

  // ── Toggle Deafen ───────────────────────────────────────────────────────────
  const toggleDeafen = useCallback(async () => {
    const { room, selfState, participants } = store;
    if (!room) return;

    if (selfState?.server_deaf && selfState.self_deaf) {
      console.warn("[Voice] Cannot undeafen: server-deafened");
      return;
    }

    const isDeafened = selfState?.self_deaf ?? false;
    const nextDeaf = !isDeafened;

    // Local WebRTC: mute remote audio elements for this client
    participants.forEach((p) => {
      if (p.audioTrack && p.audioTrack instanceof RemoteAudioTrack) {
        p.audioTrack.setVolume(nextDeaf ? 0.0 : 1.0);
      }
    });

    try {
      // Update metadata on LiveKit so other participants & backend webhooks are notified
      await room.localParticipant.setMetadata(JSON.stringify({ self_deaf: nextDeaf }));
    } catch (err) {
      console.error("[Voice] Failed to update deafen metadata:", err);
    } finally {
      syncParticipantState(room.localParticipant);
    }
  }, [store, syncParticipantState]);

  // ── Toggle Camera ───────────────────────────────────────────────────────────
  const toggleVideo = useCallback(async () => {
    const { room } = store;
    if (!room) return;

    try {
      const isEnabled = room.localParticipant.isCameraEnabled;
      await room.localParticipant.setCameraEnabled(!isEnabled);
    } catch (err) {
      console.error("[Voice] Failed to toggle camera:", err);
    } finally {
      syncParticipantState(room.localParticipant);
    }
  }, [store, syncParticipantState]);

  // ── Toggle Screen Share ─────────────────────────────────────────────────────
  const toggleScreenShare = useCallback(async () => {
    const { room } = store;
    if (!room) return;

    try {
      const isSharing = room.localParticipant.isScreenShareEnabled;
      await room.localParticipant.setScreenShareEnabled(!isSharing, { audio: true });
    } catch (err) {
      console.error("[Voice] Failed to toggle screen share:", err);
    } finally {
      syncParticipantState(room.localParticipant);
    }
  }, [store, syncParticipantState]);

  // ── Attach LiveKit Listeners ─────────────────────────────────────────────────
  function attachRoomListeners(room: Room, channelId: string, guildId: string) {
    room
      .on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        store.setConnectionState(state);
      })
      .on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        const userId = participant.identity;
        store.setParticipant(userId, {
          user_id: userId,
          channel_id: channelId,
          guild_id: guildId,
          username: participant.name ?? userId,
          speaking: false,
        });
        syncParticipantState(participant);
      })
      .on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        store.removeParticipant(participant.identity);
      })
      .on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        const speakingIds = new Set(speakers.map((s) => s.identity));
        store.participants.forEach((_, userId) => {
          store.setSpeaking(userId, speakingIds.has(userId));
        });
        const localId = room.localParticipant.identity;
        store.setSpeaking(localId, speakingIds.has(localId));
      })
      .on(
        RoomEvent.TrackSubscribed,
        (track: RemoteTrack, _pub: any, participant: RemoteParticipant) => {
          const userId = participant.identity;
          if (track.kind === Track.Kind.Audio) {
            // If the local user is currently deafened, mute the newly subscribed track immediately
            const latestState = useVoiceStore.getState();
            const isDeafened =
              latestState.selfState?.self_deaf || latestState.selfState?.server_deaf;
            if (isDeafened && typeof (track as any).setVolume === "function") {
              (track as any).setVolume(0.0);
            }

            if (track.source === Track.Source.ScreenShareAudio) {
              store.setParticipant(userId, {
                screenShareAudioTrack: track as RemoteAudioTrack,
              });
            } else {
              store.setParticipant(userId, {
                audioTrack: track as RemoteAudioTrack,
              });
            }
          } else if (track.kind === Track.Kind.Video) {
            if (track.source === Track.Source.ScreenShare) {
              store.setParticipant(userId, {
                screenShareTrack: track as RemoteVideoTrack,
              });
            } else {
              store.setParticipant(userId, {
                videoTrack: track as RemoteVideoTrack,
              });
            }
          }
          syncParticipantState(participant);
        },
      )
      .on(
        RoomEvent.TrackUnsubscribed,
        (track: RemoteTrack, _pub: any, participant: RemoteParticipant) => {
          const userId = participant.identity;
          if (track.kind === Track.Kind.Audio) {
            if (track.source === Track.Source.ScreenShareAudio) {
              store.setParticipant(userId, { screenShareAudioTrack: undefined });
            } else {
              store.setParticipant(userId, { audioTrack: undefined });
            }
          } else if (track.kind === Track.Kind.Video) {
            if (track.source === Track.Source.ScreenShare) {
              store.setParticipant(userId, { screenShareTrack: undefined });
            } else {
              store.setParticipant(userId, { videoTrack: undefined });
            }
          }
          syncParticipantState(participant);
        },
      )
      .on(RoomEvent.LocalTrackPublished, (pub: any) => {
        const local = room.localParticipant;
        const track = pub.track;
        if (!track) return;
        const update: any = {
          user_id: local.identity,
          username: local.name ?? local.identity,
          video: local.isCameraEnabled,
          screen_share: local.isScreenShareEnabled,
        };
        if (track.kind === Track.Kind.Audio) {
          update.audioTrack = track;
        } else if (track.kind === Track.Kind.Video) {
          if (track.source === Track.Source.ScreenShare) {
            update.screenShareTrack = track;
          } else {
            update.videoTrack = track;
          }
        }
        store.setParticipant(local.identity, update);
        syncParticipantState(local);
      })
      .on(RoomEvent.LocalTrackUnpublished, (pub: any) => {
        const local = room.localParticipant;
        const update: any = {};
        if (pub.kind === Track.Kind.Audio) {
          update.audioTrack = undefined;
        } else if (pub.kind === Track.Kind.Video) {
          if (pub.source === Track.Source.ScreenShare) {
            update.screenShareTrack = undefined;
          } else {
            update.videoTrack = undefined;
          }
        }
        store.setParticipant(local.identity, update);
        syncParticipantState(local);
      })
      .on(RoomEvent.TrackMuted, (_pub: any, participant: Participant) => {
        syncParticipantState(participant);
      })
      .on(RoomEvent.TrackUnmuted, (_pub: any, participant: Participant) => {
        syncParticipantState(participant);
      })
      .on(
        RoomEvent.ParticipantMetadataChanged,
        (_prev: string | undefined, participant: Participant) => {
          syncParticipantState(participant);
        },
      )
      .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        store.setConnectionState(ConnectionState.Disconnected);
        if (reason === DisconnectReason.PARTICIPANT_REMOVED) {
          console.warn("[Voice] Ejected from the voice channel by a moderator.");
          useUIStore
            .getState()
            .showToast("Ejected from the voice channel by a moderator.", "error");
        }
        // Always cleanly exit and clear channel states locally on disconnect
        leaveVoice();
      });
  }

  // Reactively synchronize local hardware states (microphone) with backend/Zustand states (selfState)
  useEffect(() => {
    const room = store.room;
    if (!room || !store.selfState) return;

    const selfMuted = store.selfState.self_mute || store.selfState.server_mute;
    const isMicEnabled = room.localParticipant.isMicrophoneEnabled;

    if (selfMuted && isMicEnabled) {
      room.localParticipant.setMicrophoneEnabled(false).catch((err) => {
        console.error("[Voice] Failed to auto-disable microphone:", err);
      });
    } else if (!selfMuted && !isMicEnabled) {
      room.localParticipant.setMicrophoneEnabled(true).catch((err) => {
        console.error("[Voice] Failed to auto-enable microphone:", err);
      });
    }
  }, [store.room, store.selfState?.self_mute, store.selfState?.server_mute]);

  return {
    room: store.room,
    connectionState: store.connectionState,
    activeChannelId: store.activeChannelId,
    participants: store.participants,
    selfState: store.selfState,

    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    toggleVideo,
    toggleScreenShare,
  };
}
