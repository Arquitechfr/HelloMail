import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  MailTag,
  CreateTagInput,
  UpdateTagInput,
  BatchSetMessageTagsInput,
} from "@/lib/api-types";
import { messageKeys } from "./messages";

export const tagKeys = {
  all: ["tags"] as const,
  list: () => ["tags", "list"] as const,
};

/** GET /api/tags — liste les libellés de l'utilisateur. */
export function useTags() {
  return useQuery({
    queryKey: tagKeys.list(),
    queryFn: () => apiFetch<{ data: MailTag[] }>("/api/tags"),
  });
}

/** POST /api/tags — crée un nouveau libellé. */
export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTagInput) =>
      apiFetch<{ data: MailTag }>("/api/tags", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tagKeys.all });
    },
  });
}

/** PATCH /api/tags/:id — met à jour un libellé (nom, couleur, ordre). */
export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateTagInput) =>
      apiFetch<{ data: MailTag }>(`/api/tags/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tagKeys.all });
      qc.invalidateQueries({ queryKey: messageKeys.all });
    },
  });
}

/** DELETE /api/tags/:id — supprime un libellé. */
export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ message: string }>(`/api/tags/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tagKeys.all });
      qc.invalidateQueries({ queryKey: messageKeys.all });
    },
  });
}

/** PATCH /api/accounts/:accountId/messages/:folder/:uid/tags — applique des tags à un message. */
export function useSetMessageTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      accountId,
      folder,
      uid,
      tags,
    }: {
      accountId: string;
      folder: string;
      uid: number;
      tags: string[];
    }) =>
      apiFetch<{ data: unknown }>(
        `/api/accounts/${accountId}/messages/${encodeURIComponent(folder)}/${uid}/tags`,
        {
          method: "PATCH",
          body: JSON.stringify({ tags }),
        },
      ),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: messageKeys.detail(variables.accountId, variables.folder, variables.uid),
      });
      qc.invalidateQueries({ queryKey: messageKeys.all });
    },
  });
}

/** POST /api/tags/:accountId/batch — applique des tags en masse. */
export function useBatchSetMessageTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      accountId,
      ...body
    }: { accountId: string } & BatchSetMessageTagsInput) =>
      apiFetch<{ modifiedCount: number }>(`/api/tags/${accountId}/batch`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messageKeys.all });
    },
  });
}
