import { useQuery } from "@tanstack/react-query";
import { auditApi, GetAuditLogsParams } from "../api/audit";
import { AuditLogEntry } from "../../types";

export const auditLogsKeys = {
  all: (guildId: string) => ["guild", guildId, "audit-logs"] as const,
  filtered: (guildId: string, params?: GetAuditLogsParams) =>
    ["guild", guildId, "audit-logs", params] as const,
};

export function useAuditLogs(guildId?: string, params?: GetAuditLogsParams) {
  const { data, isLoading, isError, error, refetch } = useQuery<AuditLogEntry[], Error>({
    queryKey: auditLogsKeys.filtered(guildId || "", params),
    queryFn: () => auditApi.getGuildAuditLogs(guildId!, params),
    enabled: Boolean(guildId),
    staleTime: 10000,
  });

  return {
    auditLogs: data || [],
    isLoading,
    isError,
    error,
    refetch,
  };
}
