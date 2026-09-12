"use client";

import { useEffect, useState, useMemo } from "react";
import { useMessageDetail } from "@/lib/queries/messages";
import { useFolders } from "@/lib/queries/folders";
import { useUIStore } from "@/lib/stores/uiStore";
import { generateSmartReplies } from "@/lib/smart-replies";
import { isDraftFolder } from "@/lib/folder-utils";
import { EmailIframe } from "@/components/mail/EmailIframe";
import { AttachmentList } from "@/components/mail/AttachmentList";
import { QuickReplyBar } from "@/components/mail/QuickReplyBar";
import { MessageMetadataHeader } from "@/components/mail/MessageMetadataHeader";
import { ReadReceiptBanner } from "@/components/mail/ReadReceiptBanner";
import { CalendarInviteBanner } from "@/components/mail/CalendarInviteBanner";
import { PgpMessageBanner } from "@/components/mail/PgpMessageBanner";
import { EmailSecurityBanner } from "@/components/mail/EmailSecurityBanner";
import { MessageToolbar } from "@/components/mail/MessageToolbar";
import { DraftEditBanner } from "@/components/mail/DraftEditBanner";
import { MessageEmptyState } from "@/components/mail/MessageEmptyState";
import { FollowUpBanner } from "@/components/mail/reminders/FollowUpBanner";
import { FollowUpDialog } from "@/components/mail/reminders/FollowUpDialog";
import { useMessageReaderActions } from "@/lib/hooks/useMessageReaderActions";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageReaderProps {
  accountId: string;
  folder: string;
  uid: number | null;
}

export function MessageReader({ accountId, folder, uid }: MessageReaderProps) {
  const selectedMessageFolder = useUIStore((s) => s.selectedMessageFolder);
  const activeFolder = selectedMessageFolder || folder;
  const { data: message, isLoading } = useMessageDetail(accountId, activeFolder, uid);
  const { data: folders } = useFolders(accountId);
  const isDraft = isDraftFolder(activeFolder, folders);
  const openCompose = useUIStore((s) => s.openCompose);
  const setSelectedUid = useUIStore((s) => s.setSelectedUid);
  const smartRepliesEnabled = useUIStore((s) => s.smartRepliesEnabled);
  const [decryptedBody, setDecryptedBody] = useState<string | null>(null);
  const [followUpOpen, setFollowUpOpen] = useState(false);

  const smartReplies = useMemo(() => {
    if (!smartRepliesEnabled || !message || isDraft) return [];
    return generateSmartReplies(message.subject, message.text || message.html);
  }, [smartRepliesEnabled, message, isDraft]);

  useEffect(() => {
    setDecryptedBody(null);
  }, [uid, activeFolder]);

  const actions = useMessageReaderActions({
    accountId,
    folder: activeFolder,
    uid,
    message,
    folders,
    isDraft,
  });


  if (uid === null) {
    return <MessageEmptyState />;
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
      {/* Indicateur de contexte si le message vient d'un autre dossier (ex: réponse envoyée) */}
      {selectedMessageFolder && selectedMessageFolder !== folder && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-muted/30 border-b border-border/60 text-xs text-muted-foreground">
          <span className="truncate">
            Message de la conversation situé dans : <strong className="text-foreground font-medium">{selectedMessageFolder}</strong>
          </span>
          <button
            type="button"
            onClick={() => useUIStore.getState().setSelectedMessageFolder(null)}
            className="text-primary hover:underline text-[11px] font-medium cursor-pointer shrink-0 ml-2"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Barre d'actions d'email */}
      <MessageToolbar
        accountId={accountId}
        folder={activeFolder}
        uid={uid!}
        isFlagged={message.flags.flagged}
        isPinned={Boolean(message.isPinned)}
        isSnoozed={!!message.snoozedUntil}
        isDraft={isDraft}
        onEditDraft={actions.handleEditDraft}
        onSnoozed={() => setSelectedUid(null)}
        onBack={() => setSelectedUid(null)}
        onReply={actions.handleReply}
        onForward={actions.handleForward}
        onToggleFlag={actions.handleToggleFlag}
        onTogglePin={actions.handleTogglePin}
        onArchive={actions.handleArchive}
        onMarkJunk={actions.handleMarkJunk}
        onDelete={actions.handleDelete}
        onPrint={actions.handlePrint}
        onDownloadEml={actions.handleDownloadEml}
        onFollowUp={() => setFollowUpOpen(true)}
      />

      {/* En-tête des métadonnées du message */}
      <MessageMetadataHeader message={message} accountId={accountId} folder={activeFolder} uid={uid!} />

      {/* Bannière de rappel de relance (Follow-Up) */}
      <FollowUpBanner
        accountId={accountId}
        folder={activeFolder}
        uid={uid!}
        subject={message.subject}
        onReply={actions.handleReply}
      />

      {/* Bannière d'alerte de sécurité de l'expéditeur */}
      <EmailSecurityBanner summary={message.securitySummary} senderEmail={message.from.address} />

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
      {isDraft && <DraftEditBanner onEditDraft={actions.handleEditDraft} />}

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
          smartReplies={smartReplies}
          onSelectSmartReply={(replyText) =>
            openCompose("reply", {
              messageId: message.messageId,
              subject: message.subject,
              from: message.from.address,
              to: [message.from.address],
              html: `<p>${replyText}</p>`,
            })
          }
          onSelectTemplate={(template) =>
            openCompose("reply", {
              messageId: message.messageId,
              subject: message.subject,
              from: message.from.address,
              to: [message.from.address],
              html: template.bodyHtml,
            })
          }
          onReply={actions.handleReply}
          onReplyAll={actions.handleReplyAll}
        />
      )}

      {/* Dialogue de programmation du rappel de relance */}
      <FollowUpDialog
        open={followUpOpen}
        onOpenChange={setFollowUpOpen}
        accountId={accountId}
        folder={activeFolder}
        uid={uid!}
      />
    </div>
  );
}
