"use client";

import { useEffect, useState } from "react";
import {
  useMessageDetail,
  useMessageThread,
  useUpdateFlags,
  useDeleteMessage,
  useMoveMessage,
  useMarkAsJunk,
  usePinMessage,
} from "@/lib/queries/messages";
import { useFolders } from "@/lib/queries/folders";
import { useUIStore } from "@/lib/stores/uiStore";
import { isDraftFolder, isTrashFolder } from "@/lib/folder-utils";
import { openDraftCompose } from "@/lib/draft-utils";
import { Button } from "@/components/ui/button";
import { EmailIframe } from "@/components/mail/EmailIframe";
import { AttachmentList } from "@/components/mail/AttachmentList";
import { MessageThreadView } from "@/components/mail/MessageThreadView";
import { QuickReplyBar } from "@/components/mail/QuickReplyBar";
import { MessageMetadataHeader } from "@/components/mail/MessageMetadataHeader";
import { ReadReceiptBanner } from "@/components/mail/ReadReceiptBanner";
import { CalendarInviteBanner } from "@/components/mail/CalendarInviteBanner";
import { PgpMessageBanner } from "@/components/mail/PgpMessageBanner";
import { MessageToolbar } from "@/components/mail/MessageToolbar";
import { useEmailShortcuts } from "@/lib/hooks/useEmailShortcuts";
import { Mail, Loader2, FileEdit, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MessageReaderProps {
  accountId: string;
  folder: string;
  uid: number | null;
}

export function MessageReader({ accountId, folder, uid }: MessageReaderProps) {
  const { data: message, isLoading } = useMessageDetail(accountId, folder, uid);
  const updateFlags = useUpdateFlags(accountId, folder);
  // `mutate` est stable en React Query v5 — ne change pas de référence entre les renders.
  const markAsSeen = updateFlags.mutate;
  const deleteMessage = useDeleteMessage(accountId, folder);
  const moveMessage = useMoveMessage(accountId, folder);
  const markAsJunk = useMarkAsJunk(accountId, folder);
  const pinMutation = usePinMessage(accountId, folder);
  const { data: thread } = useMessageThread(accountId, folder, uid);
  const { data: folders } = useFolders(accountId);
  const isDraft = isDraftFolder(folder, folders);
  const openCompose = useUIStore((s) => s.openCompose);
  const setSelectedUid = useUIStore((s) => s.setSelectedUid);
  const setSelectedFolder = useUIStore((s) => s.setSelectedFolder);
  const [decryptedBody, setDecryptedBody] = useState<string | null>(null);

  useEffect(() => {
    setDecryptedBody(null);
  }, [uid, folder]);

  const handleEditDraft = async () => {
    if (uid === null || !message) return;
    await openDraftCompose(accountId, folder, uid, message);
  };

  const handleSelectThreadMessage = (itemFolder: string, itemUid: number) => {
    if (itemFolder !== folder) setSelectedFolder(itemFolder);
    setSelectedUid(itemUid);
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

  // Marquer comme lu à l'ouverture si non lu.
  useEffect(() => {
    if (message && !message.flags.seen && uid !== null) {
      markAsSeen({ uid, flags: { seen: true } });
    }
  }, [message, uid, markAsSeen]);

  const handleDelete = () => {
    if (uid === null) return;
    // Dans la Corbeille, la suppression est définitive.
    const permanent = isTrashFolder(folder, folders);
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

  if (uid === null) {
    return (
      <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-card/10 p-8 text-center select-none">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground border border-border mb-3 shadow-xs">
          <Mail className="size-6" />
        </div>
        <h3 className="text-sm font-semibold font-display text-foreground">Aucun message sélectionné</h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-xs">
          Sélectionnez un email dans la liste ou utilisez les raccourcis clavier pour naviguer.
        </p>
        <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1 rounded bg-muted/80 px-1.5 py-0.5 font-mono border border-border">C</span>
          <span>Nouveau message</span>
          <span className="text-border">·</span>
          <span className="flex items-center gap-1 rounded bg-muted/80 px-1.5 py-0.5 font-mono border border-border">?</span>
          <span>Aide raccourcis</span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-card/10">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!message) {
    return (
      <div className="flex flex-1 items-center justify-center bg-card/10 text-muted-foreground">
        <p className="text-xs">Message introuvable</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-1 flex-col h-full bg-background overflow-hidden select-text",
        uid === null ? "hidden md:flex" : "flex",
      )}
    >
      {/* Barre d'actions d'email */}
      <MessageToolbar
        accountId={accountId}
        folder={folder}
        uid={uid!}
        isFlagged={message.flags.flagged}
        isPinned={Boolean(message.isPinned)}
        isSnoozed={!!message.snoozedUntil}
        isDraft={isDraft}
        onEditDraft={handleEditDraft}
        onSnoozed={() => setSelectedUid(null)}
        onBack={() => setSelectedUid(null)}
        onReply={handleReply}
        onForward={handleForward}
        onToggleFlag={handleToggleFlag}
        onTogglePin={handleTogglePin}
        onArchive={handleArchive}
        onMarkJunk={handleMarkJunk}
        onDelete={handleDelete}
        onPrint={handlePrint}
        onDownloadEml={handleDownloadEml}
      />

      {/* Fil de discussion de la conversation */}
      <MessageThreadView
        thread={thread}
        currentUid={uid}
        onSelectMessage={handleSelectThreadMessage}
      />

      {/* En-tête des métadonnées du message */}
      <MessageMetadataHeader message={message} accountId={accountId} folder={folder} uid={uid!} />

      {/* Bannière d'accusé de réception (MDN RFC 3798) */}
      {message.readReceiptRequestedTo && (
        <ReadReceiptBanner
          key={`${folder}-${uid}`}
          accountId={accountId}
          folder={folder}
          uid={uid}
          recipientEmail={message.readReceiptRequestedTo}
          readReceiptSentAt={message.readReceiptSentAt}
        />
      )}

      {/* Bannière d'invitation d'agenda (iCalendar RFC 5545) */}
      {message.calendarEvent && (
        <CalendarInviteBanner calendarEvent={message.calendarEvent} />
      )}

      {/* Bannière de déchiffrement OpenPGP */}
      <PgpMessageBanner
        key={`pgp-${folder}-${uid}`}
        content={message.text || message.html}
        senderEmail={message.from.address}
        onDecrypted={setDecryptedBody}
      />

      {/* Bannière d'avertissement de brouillon non envoyé */}
      {isDraft && (
        <div className="mx-6 mt-3 mb-1 flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-amber-950 dark:text-amber-200 no-print">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileEdit className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold">Ceci est un brouillon non envoyé</p>
              <p className="text-[11px] text-muted-foreground truncate">
                Vous pouvez reprendre la rédaction et l&apos;envoyer à tout moment.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleEditDraft}
            className="gap-1.5 h-7 px-2.5 text-xs font-medium shrink-0 cursor-pointer"
          >
            <Pencil className="size-3.5" />
            <span>Reprendre la rédaction</span>
          </Button>
        </div>
      )}

      {/* Corps scrollable + pièces jointes */}
      <div className="flex-1 overflow-y-auto px-6 py-4 printable-area">
        {message.attachments.length > 0 && (
          <div className="mb-4 no-print">
            <AttachmentList accountId={accountId} folder={folder} uid={uid} attachments={message.attachments} />
          </div>
        )}
        <EmailIframe
          html={decryptedBody ? undefined : message.html}
          text={decryptedBody || message.text}
        />
      </div>

      {/* Barre de réponse rapide (masquée pour les brouillons) */}
      {!isDraft && (
        <QuickReplyBar
          senderLabel={message.from.name || message.from.address}
          hasMultipleRecipients={message.to.length + (message.cc?.length ?? 0) > 1}
          accountId={accountId}
          onSelectTemplate={(template) =>
            openCompose("reply", {
              messageId: message.messageId,
              subject: message.subject,
              from: message.from.address,
              to: [message.from.address],
              html: template.bodyHtml,
            })
          }
          onReply={handleReply}
          onReplyAll={handleReplyAll}
        />
      )}
    </div>
  );
}
