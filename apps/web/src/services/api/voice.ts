import axios from "axios";
import { JoinVoiceResponse, VoiceState } from "../../features/voice/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

function getAuthHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("synapse_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function joinVoiceChannel(channelId: string): Promise<JoinVoiceResponse> {
  const res = await axios.post<JoinVoiceResponse>(
    `${API_BASE}/channels/${channelId}/voice/join`,
    {},
    { headers: getAuthHeaders() },
  );
  return res.data;
}

export async function leaveVoiceChannel(channelId: string): Promise<void> {
  await axios.delete(`${API_BASE}/channels/${channelId}/voice/leave`, {
    headers: getAuthHeaders(),
  });
}

export async function getChannelVoiceStates(channelId: string): Promise<VoiceState[]> {
  const res = await axios.get<VoiceState[]>(`${API_BASE}/channels/${channelId}/voice`, {
    headers: getAuthHeaders(),
  });
  return res.data;
}

// ── Moderator Actions ──────────────────────────────────────────────────────────

export async function modServerMute(
  channelId: string,
  targetUserId: string,
  muted: boolean,
): Promise<void> {
  const url = `${API_BASE}/channels/${channelId}/voice/members/${targetUserId}/mute`;
  if (muted) {
    await axios.post(url, {}, { headers: getAuthHeaders() });
  } else {
    await axios.delete(url, { headers: getAuthHeaders() });
  }
}

export async function modServerDeafen(
  channelId: string,
  targetUserId: string,
  deafened: boolean,
): Promise<void> {
  const url = `${API_BASE}/channels/${channelId}/voice/members/${targetUserId}/deafen`;
  if (deafened) {
    await axios.post(url, {}, { headers: getAuthHeaders() });
  } else {
    await axios.delete(url, { headers: getAuthHeaders() });
  }
}

export async function modDisconnect(channelId: string, targetUserId: string): Promise<void> {
  await axios.post(
    `${API_BASE}/channels/${channelId}/voice/members/${targetUserId}/disconnect`,
    {},
    { headers: getAuthHeaders() },
  );
}

export async function modMove(
  channelId: string,
  targetUserId: string,
  targetChannelId: string,
): Promise<void> {
  await axios.post(
    `${API_BASE}/channels/${channelId}/voice/members/${targetUserId}/move`,
    { target_channel_id: targetChannelId },
    { headers: getAuthHeaders() },
  );
}
