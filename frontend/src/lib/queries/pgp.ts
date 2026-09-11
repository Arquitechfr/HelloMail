import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { PgpKeyInfo, ContactPublicKeyInfo } from "@/lib/api-types";

export const pgpKeys = {
  all: ["pgp"] as const,
  myKeys: () => [...pgpKeys.all, "me"] as const,
  contactKeys: () => [...pgpKeys.all, "contacts"] as const,
  contactKey: (email: string) => [...pgpKeys.contactKeys(), email] as const,
};

export interface SaveUserKeyInput {
  email: string;
  name?: string;
  armoredPublicKey: string;
  armoredPrivateKey?: string;
  fingerprint: string;
  keyId: string;
  algorithm: string;
}

export interface SaveContactKeyInput {
  email: string;
  name?: string;
  armoredPublicKey: string;
  fingerprint: string;
  keyId: string;
  algorithm?: string;
}

/** GET /api/pgp/keys/me — récupère les clés personnelles de l'utilisateur. */
export function usePgpUserKeys() {
  return useQuery({
    queryKey: pgpKeys.myKeys(),
    queryFn: async () => {
      const res = await apiFetch<{ data: PgpKeyInfo[] }>("/api/pgp/keys/me");
      return res.data;
    },
  });
}

/** POST /api/pgp/keys/me — enregistre une clé personnelle. */
export function useSavePgpUserKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveUserKeyInput) =>
      apiFetch<{ data: PgpKeyInfo }>("/api/pgp/keys/me", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pgpKeys.myKeys() });
    },
  });
}

/** DELETE /api/pgp/keys/me/:keyId — supprime une clé personnelle. */
export function useDeletePgpUserKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) =>
      apiFetch<void>(`/api/pgp/keys/me/${keyId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pgpKeys.myKeys() });
    },
  });
}

/** GET /api/pgp/keys/contacts — liste toutes les clés publiques des contacts. */
export function usePgpContactKeys() {
  return useQuery({
    queryKey: pgpKeys.contactKeys(),
    queryFn: async () => {
      const res = await apiFetch<{ data: PgpKeyInfo[] }>("/api/pgp/keys/contacts");
      return res.data;
    },
  });
}

/** GET /api/pgp/keys/contacts/:email — cherche la clé publique d'un correspondant par email. */
export function usePgpContactPublicKey(email?: string) {
  return useQuery({
    queryKey: email ? pgpKeys.contactKey(email) : pgpKeys.contactKeys(),
    queryFn: async () => {
      if (!email) return null;
      const res = await apiFetch<{ data: ContactPublicKeyInfo | null }>(
        `/api/pgp/keys/contacts/${encodeURIComponent(email)}`,
      );
      return res.data;
    },
    enabled: Boolean(email),
  });
}

/** POST /api/pgp/keys/contacts — enregistre une clé publique de contact. */
export function useSavePgpContactKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveContactKeyInput) =>
      apiFetch<{ data: PgpKeyInfo }>("/api/pgp/keys/contacts", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pgpKeys.contactKeys() });
    },
  });
}

/** DELETE /api/pgp/keys/contacts/:keyId — supprime une clé de contact. */
export function useDeletePgpContactKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) =>
      apiFetch<void>(`/api/pgp/keys/contacts/${keyId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pgpKeys.contactKeys() });
    },
  });
}
