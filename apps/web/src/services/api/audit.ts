import { api } from "../../lib/api";
import { AuditLogEntry } from "../../types";

export interface GetAuditLogsParams {
  before?: string;
  limit?: number;
  action?: number;
  actor_id?: string;
  target_type?: number;
  target_id?: string;
}

export const auditApi = {
  getGuildAuditLogs: async (
    guildId: string,
    params?: GetAuditLogsParams,
  ): Promise<AuditLogEntry[]> => {
    const searchParams = new URLSearchParams();
    if (params?.before) searchParams.set("before", params.before);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.action !== undefined) searchParams.set("action", params.action.toString());
    if (params?.actor_id) searchParams.set("actor_id", params.actor_id);
    if (params?.target_type !== undefined)
      searchParams.set("target_type", params.target_type.toString());
    if (params?.target_id) searchParams.set("target_id", params.target_id);

    const queryString = searchParams.toString();
    const url = `/guilds/${guildId}/audit-logs${queryString ? `?${queryString}` : ""}`;
    const response = await api.get<AuditLogEntry[]>(url);
    return response.data;
  },
};
