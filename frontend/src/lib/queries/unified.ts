import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  Message,
  PaginatedResponse,
  UnifiedFolderType,
  UnifiedStatusResponse,
  UnifiedSearchOptions,
} from "@/lib/api-types";

export const unifiedKeys = {
  all: ["unified"] as const,
  messages: (type: UnifiedFolderType, page: number, limit: number, tag?: string | null) =>
    ["unified", "messages", type, page, limit, tag ?? ""] as const,
  status: () => ["unified", "status"] as const,
  search: (options: UnifiedSearchOptions) => ["unified", "search", options] as const,
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

/**
 * GET /api/unified/search — recherche fédérée multi-comptes avec critères avancés.
 */
export function useUnifiedSearch(options: UnifiedSearchOptions, enabled = true) {
  const params = new URLSearchParams();
  if (options.q) params.set("q", options.q);
  if (options.folder) params.set("folder", options.folder);
  if (options.accountId) params.set("accountId", options.accountId);
  if (options.from) params.set("from", options.from);
  if (options.to) params.set("to", options.to);
  if (options.subject) params.set("subject", options.subject);
  if (options.seen !== undefined) params.set("seen", String(options.seen));
  if (options.flagged !== undefined) params.set("flagged", String(options.flagged));
  if (options.isPinned !== undefined) params.set("isPinned", String(options.isPinned));
  if (options.tag) params.set("tag", options.tag);
  if (options.hasAttachments !== undefined) params.set("hasAttachments", String(options.hasAttachments));
  if (options.since) params.set("since", options.since);
  if (options.before) params.set("before", options.before);
  if (options.minSize !== undefined) params.set("minSize", String(options.minSize));
  if (options.maxSize !== undefined) params.set("maxSize", String(options.maxSize));
  if (options.includeTrash) params.set("includeTrash", "true");
  if (options.includeJunk) params.set("includeJunk", "true");
  params.set("page", String(options.page ?? 1));
  params.set("limit", String(options.limit ?? 50));

  const url = `/api/unified/search?${params.toString()}`;

  return useQuery({
    queryKey: unifiedKeys.search(options),
    queryFn: () => apiFetch<PaginatedResponse<Message>>(url),
    enabled,
  });
}
