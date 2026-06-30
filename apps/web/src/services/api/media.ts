import { api } from "../../lib/api";
import { UploadResponse } from "../../types";
import axios from "axios";

export const mediaApi = {
  generateAvatarUploadUrl: async (payload: any): Promise<UploadResponse> => {
    const response = await api.post<UploadResponse>("/users/@me/avatars/upload-url", payload);
    return response.data;
  },

  generateUserBannerUploadUrl: async (payload: any): Promise<UploadResponse> => {
    const response = await api.post<UploadResponse>("/users/@me/banners/upload-url", payload);
    return response.data;
  },

  generateGuildIconUploadUrl: async (guildId: string, payload: any): Promise<UploadResponse> => {
    const response = await api.post<UploadResponse>(`/guilds/${guildId}/icons/upload-url`, payload);
    return response.data;
  },

  generateGuildBannerUploadUrl: async (guildId: string, payload: any): Promise<UploadResponse> => {
    const response = await api.post<UploadResponse>(
      `/guilds/${guildId}/banners/upload-url`,
      payload,
    );
    return response.data;
  },

  generateAttachmentUploadUrl: async (
    channelId: string,
    payload: {
      category: string;
      extension: string;
      file_name: string;
      size: number;
      content_type: string;
    },
  ): Promise<UploadResponse> => {
    const response = await api.post<UploadResponse>(
      `/channels/${channelId}/attachments/upload-url`,
      payload,
    );
    return response.data;
  },

  uploadFileToS3: async (
    url: string,
    file: File,
    onUploadProgress?: (progressEvent: any) => void,
  ): Promise<void> => {
    await axios.put(url, file, {
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
      onUploadProgress,
    });
  },

  markUploadComplete: async (uploadId: string): Promise<void> => {
    await api.post(`/media/uploads/${uploadId}/complete`);
  },

  cancelUpload: async (uploadId: string): Promise<void> => {
    await api.delete(`/media/uploads/${uploadId}`);
  },
};
