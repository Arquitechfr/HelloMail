import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { MailRule, CreateRuleInput, UpdateRuleInput } from "@/lib/api-types";

export const ruleKeys = {
  all: ["rules"] as const,
  list: (accountId?: string) => ["rules", "list", accountId || "all"] as const,
};

/** GET /api/rules — liste les règles de tri ordonnées par priorité. */
export function useRules(accountId?: string) {
  return useQuery({
    queryKey: ruleKeys.list(accountId),
    queryFn: () =>
      apiFetch<{ data: MailRule[] }>(
        accountId ? `/api/rules?accountId=${encodeURIComponent(accountId)}` : "/api/rules",
      ),
  });
}

/** POST /api/rules — crée une nouvelle règle. */
export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRuleInput) =>
      apiFetch<{ data: MailRule }>("/api/rules", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ruleKeys.all }),
  });
}

/** PATCH /api/rules/:id — met à jour une règle. */
export function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateRuleInput) =>
      apiFetch<{ data: MailRule }>(`/api/rules/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ruleKeys.all }),
  });
}

/** DELETE /api/rules/:id — supprime une règle. */
export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ message: string }>(`/api/rules/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ruleKeys.all }),
  });
}

/** POST /api/rules/reorder — réorganise les priorités des règles. */
export function useReorderRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ruleIds: string[]) =>
      apiFetch<{ message: string }>("/api/rules/reorder", {
        method: "POST",
        body: JSON.stringify({ ruleIds }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ruleKeys.all }),
  });
}
