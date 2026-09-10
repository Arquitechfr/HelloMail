import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  EmailTemplate,
  CreateTemplateInput,
  UpdateTemplateInput,
} from "@/lib/types/templates";

export const templateKeys = {
  all: ["templates"] as const,
  list: (accountId?: string) => ["templates", "list", accountId ?? "all"] as const,
};

/** GET /api/templates — liste les modèles de l'utilisateur. */
export function useTemplates(accountId?: string) {
  const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
  return useQuery({
    queryKey: templateKeys.list(accountId),
    queryFn: () => apiFetch<{ data: EmailTemplate[] }>(`/api/templates${query}`),
  });
}

/** POST /api/templates — crée un nouveau modèle d'email. */
export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTemplateInput) =>
      apiFetch<{ data: EmailTemplate }>("/api/templates", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
}

/** PATCH /api/templates/:id — met à jour un modèle existant. */
export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateTemplateInput) =>
      apiFetch<{ data: EmailTemplate }>(`/api/templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
}

/** DELETE /api/templates/:id — supprime un modèle d'email. */
export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ message: string }>(`/api/templates/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
}
