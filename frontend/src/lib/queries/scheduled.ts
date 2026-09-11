import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { ScheduledMessage, ScheduleEmailInput } from "@/lib/api-types";

export function useScheduledMessages(accountId?: string | null) {
  return useQuery({
    queryKey: ["scheduled", accountId],
    queryFn: () => {
      if (!accountId) return [];
      return apiFetch<ScheduledMessage[]>(`/api/accounts/${accountId}/scheduled`);
    },
    enabled: Boolean(accountId),
    staleTime: 10000,
  });
}

export function useScheduleEmail(accountId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ScheduleEmailInput) =>
      apiFetch<ScheduledMessage>(`/api/accounts/${accountId}/scheduled`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled", accountId] });
      queryClient.invalidateQueries({ queryKey: ["messages", accountId] });
    },
  });
}

export function useCancelScheduledMessage(accountId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/accounts/${accountId}/scheduled/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled", accountId] });
    },
  });
}
