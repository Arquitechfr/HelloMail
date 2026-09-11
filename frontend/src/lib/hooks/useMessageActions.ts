"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import type { Message } from "@/lib/api-types";
import {
  useUpdateFlags,
  useDeleteMessage,
  useMoveMessage,
  useMarkAsJunk,
  useSnoozeMessage,
} from "@/lib/queries/messages";
import { useSetMessageTags } from "@/lib/queries/tags";
import { useUIStore } from "@/lib/stores/uiStore";
import { openDraftCompose } from "@/lib/draft-utils";

interface UseMessageActionsOptions {
  accountId: string;
  folder: string;
  message: Message;
}

export function useMessageActions({
  accountId,
  folder,
  message,
}: UseMessageActionsOptions) {
  const updateFlags = useUpdateFlags(accountId, folder);
  const deleteMessage = useDeleteMessage(accountId, folder);
  const moveMessage = useMoveMessage(accountId, folder);
  const markAsJunk = useMarkAsJunk(accountId, folder);
  const snoozeMutation = useSnoozeMessage(accountId, folder);
  const setMessageTags = useSetMessageTags();

  const openCompose = useUIStore((s) => s.openCompose);
  const selectedUid = useUIStore((s) => s.selectedUid);
  const setSelectedUid = useUIStore((s) => s.setSelectedUid);

  const uid = message.uid;
  const isSelected = selectedUid === uid;

  const toggleSeen = useCallback(() => {
    const nextSeen = !message.flags.seen;
    updateFlags.mutate({ uid, flags: { seen: nextSeen } });
    toast.success(nextSeen ? "Marqué comme lu" : "Marqué comme non lu");
  }, [message.flags.seen, uid, updateFlags]);

  const toggleFlagged = useCallback(() => {
    const nextFlagged = !message.flags.flagged;
    updateFlags.mutate({ uid, flags: { flagged: nextFlagged } });
    toast.success(
      nextFlagged
        ? "Ajouté aux messages importants"
        : "Retiré des messages importants",
    );
  }, [message.flags.flagged, uid, updateFlags]);

  const archiveMessage = useCallback(() => {
    moveMessage.mutate(
      { uid, destination: "Archive" },
      {
        onSuccess: () => {
          toast.success("Message archivé");
          if (isSelected) setSelectedUid(null);
        },
        onError: () => toast.error("Erreur lors de l'archivage"),
      },
    );
  }, [uid, moveMessage, isSelected, setSelectedUid]);

  const deleteMsg = useCallback(
    (permanent = false) => {
      deleteMessage.mutate(
        { uid, permanent },
        {
          onSuccess: () => {
            toast.success(
              permanent ? "Message supprimé définitivement" : "Message supprimé",
            );
            if (isSelected) setSelectedUid(null);
          },
          onError: () => toast.error("Erreur lors de la suppression"),
        },
      );
    },
    [uid, deleteMessage, isSelected, setSelectedUid],
  );

  const markJunkMsg = useCallback(() => {
    markAsJunk.mutate(uid, {
      onSuccess: () => {
        toast.success("Marqué comme courrier indésirable");
        if (isSelected) setSelectedUid(null);
      },
      onError: () => toast.error("Erreur lors du signalement"),
    });
  }, [uid, markAsJunk, isSelected, setSelectedUid]);

  const moveTo = useCallback(
    (destination: string) => {
      if (destination === folder) return;
      moveMessage.mutate(
        { uid, destination },
        {
          onSuccess: () => {
            toast.success(`Message déplacé vers « ${destination} »`);
            if (isSelected) setSelectedUid(null);
          },
          onError: () => toast.error("Erreur lors du déplacement"),
        },
      );
    },
    [folder, uid, moveMessage, isSelected, setSelectedUid],
  );

  const toggleTag = useCallback(
    (tagName: string) => {
      const currentTags = message.tags ?? [];
      const hasTag = currentTags.includes(tagName);
      const nextTags = hasTag
        ? currentTags.filter((t) => t !== tagName)
        : [...currentTags, tagName];

      setMessageTags.mutate(
        { accountId, folder, uid, tags: nextTags },
        {
          onSuccess: () => {
            toast.success(
              hasTag
                ? `Libellé « ${tagName} » retiré`
                : `Libellé « ${tagName} » appliqué`,
            );
          },
          onError: () => toast.error("Erreur lors de la modification des libellés"),
        },
      );
    },
    [accountId, folder, message.tags, setMessageTags, uid],
  );

  const applySnooze = useCallback(
    (date: Date | null) => {
      const isoString = date ? date.toISOString() : null;
      snoozeMutation.mutate(
        { uid, snoozedUntil: isoString },
        {
          onSuccess: () => {
            if (date) {
              toast.success("Email mis en sommeil", {
                description: `Réveil prévu le ${date.toLocaleString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`,
                action: {
                  label: "Annuler",
                  onClick: () => {
                    snoozeMutation.mutate({ uid, snoozedUntil: null });
                    toast.info("Mise en sommeil annulée");
                  },
                },
              });
              if (isSelected) setSelectedUid(null);
            } else {
              toast.success("Email réveillé et replacé dans votre boîte");
            }
          },
          onError: () => toast.error("Échec de la mise en sommeil"),
        },
      );
    },
    [uid, snoozeMutation, isSelected, setSelectedUid],
  );

  const reply = useCallback(() => {
    openCompose("reply", {
      messageId: message.messageId,
      subject: message.subject,
      from: message.from.address,
      to: [message.from.address],
    });
  }, [message.from.address, message.messageId, message.subject, openCompose]);

  const replyAll = useCallback(() => {
    const recipients = Array.from(
      new Set([
        message.from.address,
        ...(message.to?.map((t) => t.address) ?? []),
      ]),
    );
    openCompose("reply", {
      messageId: message.messageId,
      subject: message.subject,
      from: message.from.address,
      to: recipients,
    });
  }, [
    message.from.address,
    message.messageId,
    message.subject,
    message.to,
    openCompose,
  ]);

  const forward = useCallback(() => {
    openCompose("forward", {
      subject: message.subject,
    });
  }, [message.subject, openCompose]);

  const downloadEml = useCallback(() => {
    const url = `/api/accounts/${accountId}/messages/${encodeURIComponent(folder)}/${uid}/raw`;
    const link = document.createElement("a");
    link.href = url;
    link.download = `${message.subject || `message-${uid}`}.eml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [accountId, folder, message.subject, uid]);

  const print = useCallback(() => {
    window.print();
  }, []);

  const editDraft = useCallback(async () => {
    try {
      await openDraftCompose(accountId, folder, uid);
    } catch {
      // Notification d'erreur déjà gérée
    }
  }, [accountId, folder, uid]);

  return {
    toggleSeen,
    toggleFlagged,
    archiveMessage,
    deleteMsg,
    markJunkMsg,
    moveTo,
    toggleTag,
    applySnooze,
    reply,
    replyAll,
    forward,
    editDraft,
    downloadEml,
    print,
  };
}
