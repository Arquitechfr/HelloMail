import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  FollowUpReminder,
  CreateReminderInput,
  PaginatedReminders,
} from "@/lib/types/reminders";

export const reminderKeys = {
  all: ["reminders"] as const,
  list: (accountId: string, status?: string, page = 1) =>
    ["reminders", accountId, status ?? "all", page] as const,
  detail: (accountId: string, folder: string, uid: number) =>
    ["reminder", accountId, folder, uid] as const,
};

/**
 * Récupère la liste paginée des rappels d'un compte.
 */
export function useReminders(
  accountId: string | null,
  status?: string,
  page = 1,
  limit = 50,
) {
  let url = `/api/accounts/${accountId}/reminders?page=${page}&limit=${limit}`;
  if (status) {
    url += `&status=${encodeURIComponent(status)}`;
  }

  return useQuery({
    queryKey: reminderKeys.list(accountId ?? "", status, page),
    queryFn: () => apiFetch<PaginatedReminders>(url),
    enabled: !!accountId,
    refetchInterval: 30_000,
  });
}

/**
 * Récupère le rappel actif ou le plus récent pour un message spécifique.
 */
export function useMessageReminder(
  accountId: string | null,
  folder: string | null,
  uid: number | null,
) {
  return useQuery({
    queryKey: reminderKeys.detail(accountId ?? "", folder ?? "", uid ?? 0),
    queryFn: async () => {
      const res = await apiFetch<{ reminder: FollowUpReminder | null }>(
        `/api/accounts/${accountId}/messages/${encodeURIComponent(folder!)}/${uid}/reminder`,
      );
      return res.reminder;
    },
    enabled: !!accountId && !!folder && uid !== null && uid > 0,
  });
}

/**
 * Crée ou met à jour un rappel sur un message.
 */
export function useCreateReminder(accountId: string, folder: string, uid: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReminderInput) =>
      apiFetch<FollowUpReminder>(
        `/api/accounts/${accountId}/messages/${encodeURIComponent(folder)}/${uid}/reminder`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminder", accountId, folder, uid] });
      qc.invalidateQueries({ queryKey: ["reminders", accountId] });
      qc.invalidateQueries({ queryKey: ["messages", accountId] });
      qc.invalidateQueries({ queryKey: ["message", accountId, folder, uid] });
    },
  });
}

/**
 * Décale l'échéance d'un rappel (Snooze).
 */
export function useSnoozeReminder(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reminderId, remindAt }: { reminderId: string; remindAt: string }) =>
      apiFetch<FollowUpReminder>(
        `/api/accounts/${accountId}/reminders/${reminderId}/snooze`,
        {
          method: "POST",
          body: JSON.stringify({ remindAt }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders", accountId] });
      qc.invalidateQueries({ queryKey: ["reminder", accountId] });
      qc.invalidateQueries({ queryKey: ["messages", accountId] });
    },
  });
}

/**
 * Acquitte un rappel échu (traité).
 */
export function useDismissReminder(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reminderId: string) =>
      apiFetch<{ ok: boolean; reminder: FollowUpReminder }>(
        `/api/accounts/${accountId}/reminders/${reminderId}/dismiss`,
        {
          method: "POST",
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders", accountId] });
      qc.invalidateQueries({ queryKey: ["reminder", accountId] });
      qc.invalidateQueries({ queryKey: ["messages", accountId] });
    },
  });
}

/**
 * Annule un rappel.
 */
export function useCancelReminder(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reminderId: string) =>
      apiFetch<{ ok: boolean; reminder: FollowUpReminder }>(
        `/api/accounts/${accountId}/reminders/${reminderId}`,
        {
          method: "DELETE",
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders", accountId] });
      qc.invalidateQueries({ queryKey: ["reminder", accountId] });
      qc.invalidateQueries({ queryKey: ["messages", accountId] });
    },
  });
}
