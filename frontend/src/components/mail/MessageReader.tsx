"use client";

import { useEffect } from "react";
import {
  useMessageDetail,
  useMessageThread,
  useUpdateFlags,
  useDeleteMessage,
  useMoveMessage,
  useMarkAsJunk,
} from "@/lib/queries/messages";
import { useUIStore } from "@/lib/stores/uiStore";
import { EmailIframe } from "@/components/mail/EmailIframe";
import { AttachmentList } from "@/components/mail/AttachmentList";
import { MessageThreadView } from "@/components/mail/MessageThreadView";
import { QuickReplyBar } from "@/components/mail/QuickReplyBar";
import { MessageMetadataHeader } from "@/components/mail/MessageMetadataHeader";
import { ReadReceiptBanner } from "@/components/mail/ReadReceiptBanner";
import { MessageToolbar } from "@/components/mail/MessageToolbar";
import { Mail, Loader2 } from "lucide-react";
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
  const { data: thread } = useMessageThread(accountId, folder, uid);
  const openCompose = useUIStore((s) => s.openCompose);
  const setSelectedUid = useUIStore((s) => s.setSelectedUid);
  const setSelectedFolder = useUIStore((s) => s.setSelectedFolder);

  const handleSelectThreadMessage = (itemFolder: string, itemUid: number) => {
    if (itemFolder !== folder) {
      setSelectedFolder(itemFolder);
    }
    setSelectedUid(itemUid);
  };

  const handleDownloadEml = () => {
    if (!uid || !message) return;
    const url = `/api/accounts/${accountId}/messages/${encodeURIComponent(folder)}/${uid}/raw`;
    const link = document.createElement("a");
    link.href = url;
    link.download = `${message.subject || `message-${uid}`}.eml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  // Marquer comme lu à l'ouverture si non lu.
  useEffect(() => {
    if (message && !message.flags.seen && uid !== null) {
      markAsSeen({ uid, flags: { seen: true } });
    }
  }, [message, uid, markAsSeen]);

  if (uid === null) {
    return (
      <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-card/10 p-8 text-center select-none">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground border border-border mb-3 shadow-xs">
          <Mail className="size-6" />
        </div>
        <h3 className="text-sm font-semibold font-display text-foreground">
          Aucun message sélectionné
        </h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-xs">
          Sélectionnez un email dans la liste ou utilisez les raccourcis clavier pour naviguer.
        </p>
        <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1 rounded bg-muted/80 px-1.5 py-0.5 font-mono border border-border">
            C
          </span>
          <span>Nouveau message</span>
          <span className="text-border">·</span>
          <span className="flex items-center gap-1 rounded bg-muted/80 px-1.5 py-0.5 font-mono border border-border">
            ?
          </span>
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

  const handleDelete = () => {
    deleteMessage.mutate(
      { uid },
      {
        onSuccess: () => {
          toast.success("Message supprimé");
          setSelectedUid(null);
        },
        onError: () => toast.error("Erreur lors de la suppression"),
      },
    );
  };

  const handleToggleFlag = () => {
    updateFlags.mutate({ uid, flags: { flagged: !message.flags.flagged } });
  };

  const handleMarkJunk = () => {
    markAsJunk.mutate(uid, {
      onSuccess: () => {
        toast.success("Marqué comme spam");
        setSelectedUid(null);
      },
      onError: () => toast.error("Erreur"),
    });
  };

  const handleArchive = () => {
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
        isSnoozed={!!message.snoozedUntil}
        onSnoozed={() => setSelectedUid(null)}
        onBack={() => setSelectedUid(null)}
        onReply={() =>
          openCompose("reply", {
            messageId: message.messageId,
            subject: message.subject,
            from: message.from.address,
            to: [message.from.address],
          })
        }
        onForward={() => openCompose("forward", { subject: message.subject })}
        onToggleFlag={handleToggleFlag}
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
        />
      )}

      {/* Corps scrollable + pièces jointes */}
      <div className="flex-1 overflow-y-auto px-6 py-4 printable-area">
        {message.attachments.length > 0 && (
          <div className="mb-4 no-print">
            <AttachmentList accountId={accountId} folder={folder} uid={uid} attachments={message.attachments} />
          </div>
        )}
        <EmailIframe html={message.html} text={message.text} />
      </div>

      {/* Barre de réponse rapide */}
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
        onReply={() =>
          openCompose("reply", {
            messageId: message.messageId,
            subject: message.subject,
            from: message.from.address,
            to: [message.from.address],
          })
        }
        onReplyAll={() =>
          openCompose("reply", {
            messageId: message.messageId,
            subject: message.subject,
            from: message.from.address,
            to: [message.from.address, ...message.to.map((t) => t.address), ...(message.cc?.map((c) => c.address) ?? [])],
          })
        }
      />
    </div>
  );
}
