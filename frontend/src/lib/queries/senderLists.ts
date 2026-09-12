import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { SenderListEntry, SenderListType } from "@/lib/api-types";

export const senderListKeys = {
  all: ["sender-lists"] as const,
  list: (type?: SenderListType, search?: string) =>
    ["sender-lists", "list", { type, search }] as const,
};

export interface CreateSenderEntryInput {
  type: SenderListType;
  target: string;
  note?: string;
}

/** GET /api/sender-lists — liste les entrées allowlist et denylist de l'utilisateur. */
export function useSenderLists(type?: SenderListType, search?: string) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (search) params.set("search", search);
  const qs = params.toString();

  return useQuery({
    queryKey: senderListKeys.list(type, search),
    queryFn: () =>
      apiFetch<{ success: boolean; data: SenderListEntry[] }>(
        `/api/sender-lists${qs ? `?${qs}` : ""}`,
      ),
  });
}

/** POST /api/sender-lists — ajoute une nouvelle entrée dans la liste. */
export function useCreateSenderEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSenderEntryInput) =>
      apiFetch<{ success: boolean; data: SenderListEntry; message: string }>(
        "/api/sender-lists",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: senderListKeys.all });
    },
  });
}

/** DELETE /api/sender-lists/:id — supprime une entrée. */
export function useDeleteSenderEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean; message: string }>(`/api/sender-lists/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: senderListKeys.all });
    },
  });
}
