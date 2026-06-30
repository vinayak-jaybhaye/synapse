import { api } from "../../lib/api";
import { DMChannelResponse } from "../../types";

export const getDMs = async (): Promise<DMChannelResponse[]> => {
  const response = await api.get<DMChannelResponse[]>("/users/@me/dms");
  return response.data;
};

export const createDM = async (recipientId: string): Promise<DMChannelResponse> => {
  const response = await api.post<DMChannelResponse>("/dms", {
    recipient_id: recipientId,
  });
  return response.data;
};
