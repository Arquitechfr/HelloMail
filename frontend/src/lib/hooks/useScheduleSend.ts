"use client";

import { useState } from "react";
import { useScheduleEmail } from "@/lib/queries/scheduled";
import { useDeleteDraft } from "@/lib/queries/drafts";
import type { SendEmailInput } from "@/lib/api-types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface UseScheduleSendOptions {
  accountId: string;
  draftUid?: number | null;
  onClose?: () => void;
}

export function useScheduleSend({ accountId, draftUid, onClose }: UseScheduleSendOptions) {
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduledListDialogOpen, setScheduledListDialogOpen] = useState(false);

  const scheduleMutation = useScheduleEmail(accountId);
  const deleteDraft = useDeleteDraft(accountId);

  const scheduleSend = async (
    scheduledDate: Date,
    payload: SendEmailInput,
  ) => {
    if (!payload.to || payload.to.length === 0) {
      toast.error("Veuillez saisir au moins un destinataire");
      return;
    }
    if (!payload.subject.trim()) {
      toast.error("Veuillez saisir un sujet");
      return;
    }

    try {
      await scheduleMutation.mutateAsync({
        ...payload,
        scheduledAt: scheduledDate.toISOString(),
      });

      const formattedDate = format(scheduledDate, "EEEE d MMMM à HH:mm", { locale: fr });
      toast.success(`Message programmé pour ${formattedDate}`);

      // Supprime le brouillon IMAP associé s'il existait
      if (draftUid) {
        deleteDraft.mutate(draftUid);
      }

      setScheduleDialogOpen(false);
      onClose?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la programmation";
      toast.error(msg);
    }
  };

  return {
    scheduleDialogOpen,
    setScheduleDialogOpen,
    scheduledListDialogOpen,
    setScheduledListDialogOpen,
    scheduleSend,
    isScheduling: scheduleMutation.isPending,
  };
}
