import { api } from "../../lib/api";
import { Message } from "../../types";

export const messagesApi = {
  getMessages: async (
    channelId: string,
    before?: string,
    limit: number = 50
  ): Promise<Message[]> => {
    const url = `/channels/${channelId}/messages?limit=${limit}${before ? `&before=${before}` : ""}`;
    const response = await api.get<Message[]>(url);
    console.log(response.data)
    return response.data || [];
  },

  sendMessage: async (
    channelId: string,
    content: string,
    attachmentUploadIds?: string[],
    replyToMessageId?: string
  ): Promise<Message> => {
    const payload: any = { content };
    if (replyToMessageId) {
      payload.reply_to_message_id = replyToMessageId;
    }
    if (attachmentUploadIds && attachmentUploadIds.length > 0) {
      payload.attachment_upload_ids = attachmentUploadIds;
    }
    const response = await api.post<Message>(`/channels/${channelId}/messages`, payload);
    return response.data;
  },

  editMessage: async (
    channelId: string,
    messageId: string,
    content: string
  ): Promise<Message> => {
    const response = await api.patch<Message>(`/channels/${channelId}/messages/${messageId}`, {
      content,
    });
    return response.data;
  },

  deleteMessage: async (channelId: string, messageId: string): Promise<void> => {
    await api.delete(`/channels/${channelId}/messages/${messageId}`);
  },

  syncReadState: async (channelId: string, lastReadMessageId: string): Promise<void> => {
    await api.post(`/channels/${channelId}/read`, {
      last_read_message_id: lastReadMessageId,
    });
  },

  addReaction: async (channelId: string, messageId: string, emoji: string): Promise<void> => {
    await api.put(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
  },

  removeReaction: async (channelId: string, messageId: string, emoji: string): Promise<void> => {
    await api.delete(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
  },
};
