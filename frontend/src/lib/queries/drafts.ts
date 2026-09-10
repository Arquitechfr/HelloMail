import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { DraftInput, DraftResult } from "@/lib/api-types";

export const draftKeys = {
  all: (accountId: string) => ["drafts", accountId] as const,
};

/** POST /api/accounts/:accountId/drafts — crée un brouillon. */
export function useCreateDraft(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DraftInput) =>
      apiFetch<DraftResult>(`/api/accounts/${accountId}/drafts`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: draftKeys.all(accountId) }),
  });
}

/** PATCH /api/accounts/:accountId/drafts/:uid — met à jour un brouillon. */
export function useUpdateDraft(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, body }: { uid: number; body: DraftInput }) =>
      apiFetch<DraftResult>(`/api/accounts/${accountId}/drafts/${uid}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: draftKeys.all(accountId) }),
  });
}

/** DELETE /api/accounts/:accountId/drafts/:uid — supprime un brouillon. */
export function useDeleteDraft(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uid: number) =>
      apiFetch<void>(`/api/accounts/${accountId}/drafts/${uid}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: draftKeys.all(accountId) }),
  });
}
