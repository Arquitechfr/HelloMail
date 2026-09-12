import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type {
  SmartFolder,
  SmartFolderCount,
  SmartFolderMessagesResponse,
  CreateSmartFolderInput,
  UpdateSmartFolderInput,
} from '@/lib/api-types';

export const smartFolderKeys = {
  all: ['smart-folders'] as const,
  list: () => ['smart-folders', 'list'] as const,
  counts: () => ['smart-folders', 'counts'] as const,
  messages: (id: string, page = 1, limit = 50) =>
    ['smart-folders', 'messages', id, { page, limit }] as const,
};

/** GET /api/smart-folders — Récupère tous les dossiers virtuels intelligents de l'utilisateur. */
export function useSmartFolders() {
  return useQuery({
    queryKey: smartFolderKeys.list(),
    queryFn: () => apiFetch<{ data: SmartFolder[] }>('/api/smart-folders'),
  });
}

/** GET /api/smart-folders/counts — Récupère les compteurs de messages par dossier intelligent. */
export function useSmartFolderCounts() {
  return useQuery({
    queryKey: smartFolderKeys.counts(),
    queryFn: () => apiFetch<{ data: Record<string, SmartFolderCount> }>('/api/smart-folders/counts'),
    refetchInterval: 30_000,
  });
}

/** GET /api/smart-folders/:id/messages — Résout dynamiquement les messages d'un dossier intelligent. */
export function useSmartFolderMessages(id: string, page = 1, limit = 50) {
  return useQuery({
    queryKey: smartFolderKeys.messages(id, page, limit),
    queryFn: () =>
      apiFetch<SmartFolderMessagesResponse>(
        `/api/smart-folders/${id}/messages?page=${page}&limit=${limit}`,
      ),
    enabled: Boolean(id),
  });
}

/** POST /api/smart-folders — Crée un nouveau dossier intelligent. */
export function useCreateSmartFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSmartFolderInput) =>
      apiFetch<{ data: SmartFolder }>('/api/smart-folders', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: smartFolderKeys.all });
    },
  });
}

/** PATCH /api/smart-folders/:id — Met à jour un dossier intelligent. */
export function useUpdateSmartFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateSmartFolderInput & { id: string }) =>
      apiFetch<{ data: SmartFolder }>(`/api/smart-folders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: smartFolderKeys.all });
    },
  });
}

/** DELETE /api/smart-folders/:id — Supprime un dossier intelligent. */
export function useDeleteSmartFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ message: string }>(`/api/smart-folders/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: smartFolderKeys.all });
    },
  });
}

/** POST /api/smart-folders/reorder — Réordonne les dossiers intelligents. */
export function useReorderSmartFolders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<{ message: string }>('/api/smart-folders/reorder', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: smartFolderKeys.all });
    },
  });
}
