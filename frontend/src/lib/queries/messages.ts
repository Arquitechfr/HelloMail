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
  ThreadResponse,
} from "@/lib/api-types";

export const messageKeys = {
  all: ["messages"] as const,
  list: (accountId: string, folder: string, page: number, limit: number, tag?: string | null) =>
    ["messages", accountId, folder, page, limit, tag ?? ""] as const,
  detail: (accountId: string, folder: string, uid: number) =>
    ["message", accountId, folder, uid] as const,
  thread: (accountId: string, folder: string, uid: number) =>
    ["thread", accountId, folder, uid] as const,
  search: (accountId: string, query: string, page: number, limit: number) =>
    ["search", accountId, query, page, limit] as const,
};

/** GET /api/accounts/:accountId/messages — liste paginée avec support du filtre par étiquette. */
export function useMessages(
  accountId: string | null,
  folder: string,
  page = 1,
  limit = 50,
  tag?: string | null,
) {
  let url = `/api/accounts/${accountId}/messages?page=${page}&limit=${limit}`;
  if (tag) {
    url += `&tag=${encodeURIComponent(tag)}`;
  } else {
    url += `&folder=${encodeURIComponent(folder)}`;
  }

  return useQuery({
    queryKey: messageKeys.list(accountId ?? "", folder, page, limit, tag),
    queryFn: () => apiFetch<PaginatedResponse<Message>>(url),
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

/** GET /api/accounts/:accountId/messages/:folder/:uid/thread — fil de discussion. */
export function useMessageThread(accountId: string | null, folder: string, uid: number | null) {
  return useQuery({
    queryKey: messageKeys.thread(accountId ?? "", folder, uid ?? 0),
    queryFn: () =>
      apiFetch<ThreadResponse>(
        `/api/accounts/${accountId}/messages/${encodeURIComponent(folder)}/${uid}/thread`,
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

/** POST /api/accounts/:accountId/messages/:folder/:uid/receipt — envoie un accusé de réception MDN. */
export function useSendReadReceipt(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ folder, uid }: { folder: string; uid: number }) =>
      apiFetch<{ ok: boolean; sentTo: string }>(
        `/api/accounts/${accountId}/messages/${encodeURIComponent(folder)}/${uid}/receipt`,
        { method: "POST" },
      ),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: messageKeys.detail(accountId, variables.folder, variables.uid),
      });
      qc.invalidateQueries({
        queryKey: ["messages", accountId, variables.folder],
      });
    },
  });
}

/** PATCH /api/accounts/:accountId/messages/:folder/:uid/snooze — met en sommeil ou réveille un email. */
export function useSnoozeMessage(accountId: string, folder: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, snoozedUntil }: { uid: number; snoozedUntil: string | null }) =>
      apiFetch<{ ok: boolean }>(
        `/api/accounts/${accountId}/messages/${encodeURIComponent(folder)}/${uid}/snooze`,
        {
          method: "PATCH",
          body: JSON.stringify({ snoozedUntil }),
        },
      ),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: messageKeys.detail(accountId, folder, variables.uid),
      });
      qc.invalidateQueries({
        queryKey: ["messages", accountId],
      });
    },
  });
}

/** PATCH /api/accounts/:accountId/messages/:folder/:uid/pin — met en avant ou retire la mise en avant d'un message. */
export function usePinMessage(accountId: string, folder: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, isPinned }: { uid: number; isPinned: boolean }) =>
      apiFetch<Message>(
        `/api/accounts/${accountId}/messages/${encodeURIComponent(folder)}/${uid}/pin`,
        {
          method: "PATCH",
          body: JSON.stringify({ isPinned }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      qc.invalidateQueries({ queryKey: ["unified"] });
    },
  });
}


