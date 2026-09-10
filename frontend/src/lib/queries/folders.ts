import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { FolderInfo } from "@/lib/api-types";

export const folderKeys = {
  list: (accountId: string) => ["folders", accountId] as const,
};

/** GET /api/accounts/:accountId/folders — liste les dossiers IMAP. */
export function useFolders(accountId: string | null) {
  return useQuery({
    queryKey: folderKeys.list(accountId ?? ""),
    queryFn: () => apiFetch<FolderInfo[]>(`/api/accounts/${accountId}/folders`),
    enabled: !!accountId,
  });
}

/** POST /api/accounts/:accountId/folders — crée un dossier. */
export function useCreateFolder(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) =>
      apiFetch<{ path: string }>(`/api/accounts/${accountId}/folders`, {
        method: "POST",
        body: JSON.stringify({ path }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: folderKeys.list(accountId) }),
  });
}

/** PATCH /api/accounts/:accountId/folders/:path — renomme un dossier. */
export function useRenameFolder(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, newPath }: { path: string; newPath: string }) =>
      apiFetch<{ path: string }>(`/api/accounts/${accountId}/folders/${encodeURIComponent(path)}`, {
        method: "PATCH",
        body: JSON.stringify({ newPath }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: folderKeys.list(accountId) }),
  });
}

/** DELETE /api/accounts/:accountId/folders/:path — supprime un dossier. */
export function useDeleteFolder(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) =>
      apiFetch<void>(`/api/accounts/${accountId}/folders/${encodeURIComponent(path)}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: folderKeys.list(accountId) }),
  });
}
