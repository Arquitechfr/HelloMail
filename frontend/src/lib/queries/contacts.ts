import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Contact } from "@/lib/api-types";

export const contactKeys = {
  all: ["contacts"] as const,
  list: ["contacts", "list"] as const,
  search: (q: string) => ["contacts", "search", q] as const,
};

/** GET /api/contacts — liste les contacts de l'utilisateur. */
export function useContacts() {
  return useQuery({
    queryKey: contactKeys.list,
    queryFn: () => apiFetch<{ contacts: Contact[] }>("/api/contacts"),
  });
}

/** GET /api/contacts/search?q=... — recherche des contacts (autocomplétion). */
export function useSearchContacts(q: string, enabled: boolean) {
  return useQuery({
    queryKey: contactKeys.search(q),
    queryFn: () => apiFetch<{ contacts: Contact[] }>(`/api/contacts/search?q=${encodeURIComponent(q)}`),
    enabled: enabled && q.length >= 2,
    staleTime: 30_000,
  });
}

/** POST /api/contacts — crée un contact. */
export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; email: string; phone?: string; notes?: string }) =>
      apiFetch<{ contact: Contact }>("/api/contacts", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: contactKeys.all }),
  });
}

/** PATCH /api/contacts/:id — met à jour un contact. */
export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { id: string; name?: string; email?: string; phone?: string; notes?: string }) => {
      const { id, ...data } = body;
      return apiFetch<{ contact: Contact }>(`/api/contacts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: contactKeys.all }),
  });
}

/** DELETE /api/contacts/:id — supprime un contact. */
export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ message: string }>(`/api/contacts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: contactKeys.all }),
  });
}

/** POST /api/contacts/import — importe des contacts depuis vCard ou CSV. */
export function useImportContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { format: "vcf" | "csv"; content: string }) =>
      apiFetch<import("@/lib/api-types").ContactImportResult>("/api/contacts/import", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: contactKeys.all }),
  });
}

/** Télécharge l'export des contacts au format vCard (.vcf) ou CSV (.csv). */
export async function downloadContactsExport(format: "vcf" | "csv"): Promise<void> {
  const { apiFetchBlob } = await import("@/lib/api");
  const blob = await apiFetchBlob(`/api/contacts/export?format=${format}`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = format === "vcf" ? "contacts.vcf" : "contacts.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

