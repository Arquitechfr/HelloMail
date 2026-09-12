"use client";

import { useEffect } from "react";
import type { MessageDetail } from "@/lib/api-types";
import {
  useUpdateFlags,
  useDeleteMessage,
  useMoveMessage,
  useMarkAsJunk,
  usePinMessage,
} from "@/lib/queries/messages";
import { useUIStore } from "@/lib/stores/uiStore";
import { isTrashFolder } from "@/lib/folder-utils";
import { openDraftCompose } from "@/lib/draft-utils";
import { useEmailShortcuts } from "@/lib/hooks/useEmailShortcuts";
import { toast } from "sonner";

interface UseMessageReaderActionsProps {
  accountId: string;
  folder: string;
  uid: number | null;
  message?: MessageDetail | null;
  folders?: unknown[];
  isDraft: boolean;
}

export function useMessageReaderActions({
  accountId,
  folder,
  uid,
  message,
  folders,
  isDraft,
}: UseMessageReaderActionsProps) {
  const updateFlags = useUpdateFlags(accountId, folder);
  const markAsSeen = updateFlags.mutate;
  const deleteMessage = useDeleteMessage(accountId, folder);
  const moveMessage = useMoveMessage(accountId, folder);
  const markAsJunk = useMarkAsJunk(accountId, folder);
  const pinMutation = usePinMessage(accountId, folder);

  const openCompose = useUIStore((s) => s.openCompose);
  const setSelectedUid = useUIStore((s) => s.setSelectedUid);

  // Marquer comme lu à l'ouverture si non lu
  useEffect(() => {
    if (message && !message.flags.seen && uid !== null) {
      markAsSeen({ uid, flags: { seen: true } });
    }
  }, [message, uid, markAsSeen]);

  const handleEditDraft = async () => {
    if (uid === null || !message) return;
    await openDraftCompose(accountId, folder, uid, message);
  };

  const handleDownloadEml = () => {
    if (!uid || !message) return;
    const link = document.createElement("a");
    link.href = `/api/accounts/${accountId}/messages/${encodeURIComponent(folder)}/${uid}/raw`;
    link.download = `${message.subject || `message-${uid}`}.eml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => window.print();

  const handleDelete = () => {
    if (uid === null) return;
    const permanent = isTrashFolder(folder, folders as never);
    deleteMessage.mutate(
      { uid, permanent },
      {
        onSuccess: () => {
          toast.success(
            permanent
              ? "Message supprimé définitivement"
              : "Message déplacé vers la Corbeille",
          );
          setSelectedUid(null);
        },
        onError: () => toast.error("Erreur lors de la suppression"),
      },
    );
  };

  const handleToggleFlag = () => {
    if (uid === null || !message) return;
    updateFlags.mutate({ uid, flags: { flagged: !message.flags.flagged } });
  };

  const handleTogglePin = () => {
    if (uid === null || !message) return;
    const nextPinned = !message.isPinned;
    pinMutation.mutate(
      { uid, isPinned: nextPinned },
      {
        onSuccess: () => toast.success(nextPinned ? "Message mis en avant" : "Mise en avant retirée"),
        onError: () => toast.error("Erreur lors de la mise en avant"),
      },
    );
  };

  const handleMarkJunk = () => {
    if (uid === null) return;
    markAsJunk.mutate(uid, {
      onSuccess: () => {
        toast.success("Marqué comme spam");
        setSelectedUid(null);
      },
      onError: () => toast.error("Erreur"),
    });
  };

  const handleArchive = () => {
    if (uid === null) return;
    moveMessage.mutate(
      { uid, destination: "Archive" },
      {
        onSuccess: () => {
          toast.success("Message archivé");
          setSelectedUid(null);
        },
        onError: () => toast.error("Erreur lors du déplacement"),
      },
    );
  };

  const handleReply = () => {
    if (!message) return;
    openCompose("reply", {
      messageId: message.messageId,
      subject: message.subject,
      from: message.from.address,
      to: [message.from.address],
    });
  };

  const handleReplyAll = () => {
    if (!message) return;
    openCompose("reply", {
      messageId: message.messageId,
      subject: message.subject,
      from: message.from.address,
      to: [
        message.from.address,
        ...message.to.map((t) => t.address),
        ...(message.cc?.map((c) => c.address) ?? []),
      ],
    });
  };

  const handleForward = () => {
    if (message) openCompose("forward", { subject: message.subject });
  };

  const handleToggleSeen = () => {
    if (uid !== null && message) updateFlags.mutate({ uid, flags: { seen: !message.flags.seen } });
  };

  useEmailShortcuts({
    enabled: uid !== null && !!message,
    onReply: isDraft ? handleEditDraft : handleReply,
    onReplyAll: isDraft ? undefined : handleReplyAll,
    onForward: isDraft ? undefined : handleForward,
    onToggleSeen: handleToggleSeen,
    onToggleFlagged: handleToggleFlag,
    onTogglePin: handleTogglePin,
    onArchive: isDraft ? undefined : handleArchive,
    onDelete: handleDelete,
    onMarkJunk: isDraft ? undefined : handleMarkJunk,
    onPrint: handlePrint,
  });

  return {
    handleEditDraft,
    handleDownloadEml,
    handlePrint,
    handleDelete,
    handleToggleFlag,
    handleTogglePin,
    handleMarkJunk,
    handleArchive,
    handleReply,
    handleReplyAll,
    handleForward,
    handleToggleSeen,
  };
}
