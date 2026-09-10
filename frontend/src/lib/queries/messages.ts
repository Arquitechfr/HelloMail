import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import type {
  Message,
  MessageDetail,
  PaginatedResponse,
  FlagsUpdate,
  BatchActionInput,
  SendEmailInput,
  SendResult,
  FetchMoreResult,
} from "@/lib/api-types";

export const messageKeys = {
  list: (accountId: string, folder: string, page: number, limit: number) =>
    ["messages", accountId, folder, page, limit] as const,
  detail: (accountId: string, folder: string, uid: number) =>
    ["message", accountId, folder, uid] as const,
  search: (accountId: string, query: string, page: number, limit: number) =>
    ["search", accountId, query, page, limit] as const,
};

/** GET /api/accounts/:accountId/messages — liste paginée. */
export function useMessages(
  accountId: string | null,
  folder: string,
  page = 1,
  limit = 50,
) {
  return useQuery({
    queryKey: messageKeys.list(accountId ?? "", folder, page, limit),
    queryFn: () =>
      apiFetch<PaginatedResponse<Message>>(
        `/api/accounts/${accountId}/messages?folder=${encodeURIComponent(folder)}&page=${page}&limit=${limit}`,
      ),
    enabled: !!accountId,
    // Polling de fallback (30s) — l'IDLE IMAP peut avoir des timeouts,
    // le SSE peut manquer des événements. Le polling garantit la fraîcheur.
    refetchInterval: 30_000,
  });
}

/** GET /api/accounts/:accountId/messages/search — recherche par opérateurs. */
export function useSearch(
  accountId: string | null,
  query: string,
  page = 1,
  limit = 50,
) {
  return useQuery({
    queryKey: messageKeys.search(accountId ?? "", query, page, limit),
    queryFn: () =>
      apiFetch<PaginatedResponse<Message>>(
        `/api/accounts/${accountId}/messages/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
      ),
    enabled: !!accountId && query.length > 0,
  });
}

/** GET /api/accounts/:accountId/messages/:folder/:uid — détail d'un message. */
export function useMessageDetail(accountId: string | null, folder: string, uid: number | null) {
  return useQuery({
    queryKey: messageKeys.detail(accountId ?? "", folder, uid ?? 0),
    queryFn: () =>
      apiFetch<MessageDetail>(
        `/api/accounts/${accountId}/messages/${encodeURIComponent(folder)}/${uid}`,
      ),
    enabled: !!accountId && uid !== null,
  });
}

/** PATCH /api/accounts/:accountId/messages/:folder/:uid/flags */
export function useUpdateFlags(accountId: string, folder: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, flags }: { uid: number; flags: FlagsUpdate }) =>
      apiFetch<void>(
        `/api/accounts/${accountId}/messages/${encodeURIComponent(folder)}/${uid}/flags`,
        { method: "PATCH", body: JSON.stringify(flags) },
      ),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["messages", accountId, folder] });
      qc.invalidateQueries({ queryKey: ["folders", accountId] });
      // Invalide aussi le détail pour que le frontend reflète le changement de flags.
      qc.invalidateQueries({ queryKey: ["message", accountId, folder, variables.uid] });
    },
  });
}

/** DELETE /api/accounts/:accountId/messages/:folder/:uid */
export function useDeleteMessage(accountId: string, folder: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, permanent }: { uid: number; permanent?: boolean }) =>
      apiFetch<void>(
        `/api/accounts/${accountId}/messages/${encodeURIComponent(folder)}/${uid}${permanent ? "?permanent=true" : ""}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", accountId, folder] });
      qc.invalidateQueries({ queryKey: ["folders", accountId] });
    },
  });
}

/** POST /api/accounts/:accountId/messages/:folder/:uid/move */
export function useMoveMessage(accountId: string, folder: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, destination }: { uid: number; destination: string }) =>
      apiFetch<void>(
        `/api/accounts/${accountId}/messages/${encodeURIComponent(folder)}/${uid}/move`,
        { method: "POST", body: JSON.stringify({ destination }) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", accountId, folder] });
      qc.invalidateQueries({ queryKey: ["folders", accountId] });
    },
  });
}

/** POST /api/accounts/:accountId/messages/:folder/:uid/junk */
export function useMarkAsJunk(accountId: string, folder: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uid: number) =>
      apiFetch<void>(
        `/api/accounts/${accountId}/messages/${encodeURIComponent(folder)}/${uid}/junk`,
        { method: "POST" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", accountId, folder] });
      qc.invalidateQueries({ queryKey: ["folders", accountId] });
    },
  });
}

/** POST /api/accounts/:accountId/messages/batch */
export function useBatchAction(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BatchActionInput) =>
      apiFetch<void>(`/api/accounts/${accountId}/messages/batch`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", accountId] });
      qc.invalidateQueries({ queryKey: ["folders", accountId] });
    },
  });
}

/** POST /api/accounts/:accountId/send */
export function useSendEmail(accountId: string) {
  return useMutation({
    mutationFn: (input: SendEmailInput) =>
      apiFetch<SendResult>(`/api/accounts/${accountId}/send`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

/** POST /api/accounts/:accountId/messages/fetch-more — pagination arrière. */
export function useFetchMore(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ folder, count }: { folder: string; count?: number }) =>
      apiFetch<FetchMoreResult>(`/api/accounts/${accountId}/messages/fetch-more`, {
        method: "POST",
        body: JSON.stringify({ folder, count }),
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["messages", accountId, variables.folder] });
    },
  });
}

/** Télécharge une pièce jointe via fetch binaire. */
export async function downloadAttachment(
  accountId: string,
  folder: string,
  uid: number,
  part: string,
  filename: string,
): Promise<void> {
  const blob = await apiFetchBlob(
    `/api/accounts/${accountId}/messages/${encodeURIComponent(folder)}/${uid}/attachments/${part}`,
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
