import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Account, CreateImapAccountInput } from "@/lib/api-types";

export const accountKeys = {
  all: ["accounts"] as const,
};

/** GET /api/accounts — liste les comptes de l'utilisateur. */
export function useAccounts() {
  return useQuery({
    queryKey: accountKeys.all,
    queryFn: () => apiFetch<Account[]>("/api/accounts"),
  });
}

/** POST /api/accounts — crée un compte IMAP. */
export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateImapAccountInput) =>
      apiFetch<Account>("/api/accounts", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.all }),
  });
}

/** DELETE /api/accounts/:id */
export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/accounts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.all }),
  });
}

/** PATCH /api/accounts/:id/active — active/désactive un compte. */
export function useToggleAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch<Account>(`/api/accounts/${id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.all }),
  });
}

export interface UpdateSignatureInput {
  id: string;
  signature: {
    enabled: boolean;
    text: string;
    html?: string;
  };
}

/** PATCH /api/accounts/:id/signature — met à jour la signature d'un compte. */
export function useUpdateSignature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, signature }: UpdateSignatureInput) =>
      apiFetch<Account>(`/api/accounts/${id}/signature`, {
        method: "PATCH",
        body: JSON.stringify(signature),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.all }),
  });
}
