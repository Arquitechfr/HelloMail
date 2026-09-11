import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  Message,
  PaginatedResponse,
  UnifiedFolderType,
  UnifiedStatusResponse,
} from "@/lib/api-types";

export const unifiedKeys = {
  all: ["unified"] as const,
  messages: (type: UnifiedFolderType, page: number, limit: number, tag?: string | null) =>
    ["unified", "messages", type, page, limit, tag ?? ""] as const,
  status: () => ["unified", "status"] as const,
};

/**
 * GET /api/unified/messages — liste paginée de tous les messages unifiés par type.
 */
export function useUnifiedMessages(
  type: UnifiedFolderType = "inbox",
  page = 1,
  limit = 50,
  tag?: string | null,
) {
  let url = `/api/unified/messages?type=${encodeURIComponent(type)}&page=${page}&limit=${limit}`;
  if (tag) {
    url += `&tag=${encodeURIComponent(tag)}`;
  }

  return useQuery({
    queryKey: unifiedKeys.messages(type, page, limit, tag),
    queryFn: () => apiFetch<PaginatedResponse<Message>>(url),
    refetchInterval: 30_000,
  });
}

/**
 * GET /api/unified/status — compteurs consolidés de messages non-lus et totaux.
 */
export function useUnifiedStatus() {
  return useQuery({
    queryKey: unifiedKeys.status(),
    queryFn: () => apiFetch<UnifiedStatusResponse>("/api/unified/status"),
    refetchInterval: 30_000,
  });
}
