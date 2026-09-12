"use client";

import { useState, useCallback } from "react";
import { hasAttachmentMention } from "@/lib/attachment-detector";

interface UseAttachmentReminderProps {
  subject: string;
  body: string;
  hasAttachments: boolean;
  enabled: boolean;
  onProceedSend: () => void;
}

/**
 * Hook de détection d'oubli de pièces jointes (Phase 28).
 * Découple la logique de vérification et de dialogue pour respecter le plafond de 300 lignes.
 */
export function useAttachmentReminder({
  subject,
  body,
  hasAttachments,
  enabled,
  onProceedSend,
}: UseAttachmentReminderProps) {
  const [missingAttachmentOpen, setMissingAttachmentOpen] = useState(false);

  const checkAttachmentAndSend = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (enabled && !hasAttachments && hasAttachmentMention(subject, body)) {
        setMissingAttachmentOpen(true);
        return false;
      }
      onProceedSend();
      return true;
    },
    [enabled, hasAttachments, subject, body, onProceedSend],
  );

  const confirmSendWithoutAttachment = useCallback(() => {
    setMissingAttachmentOpen(false);
    onProceedSend();
  }, [onProceedSend]);

  return {
    missingAttachmentOpen,
    setMissingAttachmentOpen,
    checkAttachmentAndSend,
    confirmSendWithoutAttachment,
  };
}
