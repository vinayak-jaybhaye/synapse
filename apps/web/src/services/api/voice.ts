import { api } from "../../lib/api";
import { JoinVoiceResponse, VoiceState } from "../../features/voice/types";

export async function joinVoiceChannel(channelId: string): Promise<JoinVoiceResponse> {
  const res = await api.post<JoinVoiceResponse>(`/channels/${channelId}/voice/join`, {});
  return res.data;
}

export async function leaveVoiceChannel(channelId: string): Promise<void> {
  await api.delete(`/channels/${channelId}/voice/leave`);
}

export async function getChannelVoiceStates(channelId: string): Promise<VoiceState[]> {
  const res = await api.get<VoiceState[]>(`/channels/${channelId}/voice`);
  return res.data;
}

// ── Moderator Actions ──────────────────────────────────────────────────────────

export async function modServerMute(
  channelId: string,
  targetUserId: string,
  muted: boolean,
): Promise<void> {
  const url = `/channels/${channelId}/voice/members/${targetUserId}/mute`;
  if (muted) {
    await api.post(url, {});
  } else {
    await api.delete(url);
  }
}

export async function modServerDeafen(
  channelId: string,
  targetUserId: string,
  deafened: boolean,
): Promise<void> {
  const url = `/channels/${channelId}/voice/members/${targetUserId}/deafen`;
  if (deafened) {
    await api.post(url, {});
  } else {
    await api.delete(url);
  }
}

export async function modDisconnect(channelId: string, targetUserId: string): Promise<void> {
  await api.post(`/channels/${channelId}/voice/members/${targetUserId}/disconnect`, {});
}

export async function modMove(
  channelId: string,
  targetUserId: string,
  targetChannelId: string,
): Promise<void> {
  await api.post(`/channels/${channelId}/voice/members/${targetUserId}/move`, {
    target_channel_id: targetChannelId,
  });
}
