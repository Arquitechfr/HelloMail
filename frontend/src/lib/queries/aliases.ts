import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { AccountAlias } from "@/lib/api-types";
import { accountKeys } from "./accounts";

export const aliasKeys = {
  all: ["account-aliases"] as const,
  byAccount: (accountId: string) => [...aliasKeys.all, accountId] as const,
};

export interface CreateAccountAliasInput {
  name?: string;
  email: string;
  isDefault?: boolean;
}

export interface UpdateAccountAliasInput {
  name?: string;
  email?: string;
  isDefault?: boolean;
}

/** GET /api/accounts/:accountId/aliases — liste les alias d'un compte. */
export function useAccountAliases(accountId?: string) {
  return useQuery({
    queryKey: accountId ? aliasKeys.byAccount(accountId) : aliasKeys.all,
    queryFn: () => apiFetch<AccountAlias[]>(`/api/accounts/${accountId}/aliases`),
    enabled: Boolean(accountId),
  });
}

/** POST /api/accounts/:accountId/aliases — ajoute un nouvel alias. */
export function useCreateAccountAlias(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAccountAliasInput) =>
      apiFetch<AccountAlias>(`/api/accounts/${accountId}/aliases`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: aliasKeys.byAccount(accountId) });
      qc.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}

/** PATCH /api/accounts/:accountId/aliases/:aliasId — met à jour un alias existant. */
export function useUpdateAccountAlias(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      aliasId,
      body,
    }: {
      aliasId: string;
      body: UpdateAccountAliasInput;
    }) =>
      apiFetch<AccountAlias>(`/api/accounts/${accountId}/aliases/${aliasId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: aliasKeys.byAccount(accountId) });
      qc.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}

/** DELETE /api/accounts/:accountId/aliases/:aliasId — supprime un alias. */
export function useDeleteAccountAlias(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (aliasId: string) =>
      apiFetch<void>(`/api/accounts/${accountId}/aliases/${aliasId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: aliasKeys.byAccount(accountId) });
      qc.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}
