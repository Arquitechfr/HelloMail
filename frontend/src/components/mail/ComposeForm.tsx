"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import DOMPurify from "dompurify";
import { useSendEmail } from "@/lib/queries/messages";
import { useCreateDraft, useUpdateDraft, useDeleteDraft } from "@/lib/queries/drafts";
import { useAccounts } from "@/lib/queries/accounts";
import { useUndoSendStore, type RestoredComposeData } from "@/lib/stores/undoSendStore";
import { htmlToText } from "@/lib/compose-utils";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/mail/RichTextEditor";
import { ComposeRecipients } from "@/components/mail/ComposeRecipients";
import { ComposeActions } from "@/components/mail/ComposeActions";
import { AttachmentDropzone, type AttachmentItem } from "@/components/mail/AttachmentDropzone";
import { ScheduleSendDialog } from "@/components/mail/ScheduleSendDialog";
import { ScheduledMessagesDialog } from "@/components/mail/ScheduledMessagesDialog";
import { useScheduleSend } from "@/lib/hooks/useScheduleSend";
import { useComposeSignature } from "@/lib/hooks/useComposeSignature";
import { useComposePgp } from "@/lib/hooks/useComposePgp";
import { toast } from "sonner";
import type { SendEmailInput } from "@/lib/api-types";
import type { EmailTemplate } from "@/lib/types/templates";

export type DraftStatus = "idle" | "saving" | "saved" | "error";

interface ComposeFormProps {
  accountId: string;
  mode: "new" | "reply" | "forward";
  replyTo?: { messageId?: string; subject?: string; from?: string; to?: string[]; html?: string } | null;
  restoredData?: RestoredComposeData | null;
  draftUid: number | null;
  onDraftUidChange: (uid: number | null) => void;
  onDraftStatusChange: (status: DraftStatus) => void;
  onSent: () => void;
  onClose: () => void;
}

export function ComposeForm({
  accountId,
  mode,
  replyTo,
  restoredData,
  draftUid,
  onDraftUidChange,
  onDraftStatusChange,
  onSent,
  onClose,
}: ComposeFormProps) {
  const sendEmail = useSendEmail(accountId);
  const createDraft = useCreateDraft(accountId);
  const updateDraft = useUpdateDraft(accountId);
  const deleteDraft = useDeleteDraft(accountId);
  const { undoSendDelay, queueSend } = useUndoSendStore();

  const initialSubject = () => {
    if (restoredData?.subject) return restoredData.subject;
    if ((mode === "reply" || mode === "forward") && replyTo?.subject) {
      const p = mode === "reply" ? "Re:" : "Fwd:";
      return replyTo.subject.startsWith(p) ? replyTo.subject : `${p} ${replyTo.subject}`;
    }
    return "";
  };

  const [from, setFrom] = useState<{ name?: string; address: string } | undefined>(restoredData?.from);
  const [to, setTo] = useState(restoredData?.to ?? (replyTo && mode === "reply" ? replyTo.from ?? "" : ""));
  const [cc, setCc] = useState(restoredData?.cc ?? "");
  const [bcc, setBcc] = useState(restoredData?.bcc ?? "");
  const [subject, setSubject] = useState(initialSubject());
  const [body, setBody] = useState<string>(restoredData?.body ?? replyTo?.html ?? "");
  const [attachments, setAttachments] = useState<AttachmentItem[]>(restoredData?.attachments ?? []);
  const [requestReadReceipt, setRequestReadReceipt] = useState(restoredData?.requestReadReceipt ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(!!(restoredData?.cc || restoredData?.bcc));
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

  const { data: accounts } = useAccounts();
  const currentAccount = accounts?.find((a) => a._id === accountId);

  const { handleInsertSignature } = useComposeSignature({
    currentAccount,
    mode,
    body,
    setBody,
    hasRestoredData: Boolean(restoredData),
  });

  const {
    scheduleDialogOpen,
    setScheduleDialogOpen,
    scheduledListDialogOpen,
    setScheduledListDialogOpen,
    scheduleSend,
  } = useScheduleSend({ accountId, draftUid, onClose });

  const {
    pgpEncrypt,
    setPgpEncrypt,
    pgpSign,
    setPgpSign,
    processPgpPayload,
  } = useComposePgp({ fromAddress: from?.address || currentAccount?.emailAddress });

  const buildPayload = useCallback((): SendEmailInput => {
    return {
      from: from ? { name: from.name, address: from.address } : undefined,
      to: to.split(",").map((s) => s.trim()).filter(Boolean),
      cc: cc ? cc.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      bcc: bcc ? bcc.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      subject,
      text: htmlToText(body),
      html: DOMPurify.sanitize(body),
      attachments: attachments.length > 0
        ? attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType }))
        : undefined,
      inReplyTo: mode === "reply" ? replyTo?.messageId : undefined,
      references: mode === "reply" && replyTo?.messageId ? [replyTo.messageId] : undefined,
      requestReadReceipt: requestReadReceipt ? true : undefined,
    };
  }, [from, to, cc, bcc, subject, body, attachments, mode, replyTo, requestReadReceipt]);

  // Auto-save avec debounce 5s (incluant les pièces jointes).
  const saveDraft = useCallback(async () => {
    if (!subject && !body && !to && attachments.length === 0) return;
    const snapshot = JSON.stringify({
      from: from?.address,
      to,
      cc,
      bcc,
      subject,
      body,
      att: attachments.map((a) => a.filename),
    });
    if (snapshot === lastSavedRef.current) return;

    onDraftStatusChange("saving");
    const draftBody = buildPayload();

    try {
      if (draftUid) {
        await updateDraft.mutateAsync({ uid: draftUid, body: draftBody });
      } else {
        const result = await createDraft.mutateAsync(draftBody);
        if (result.uid) onDraftUidChange(result.uid);
      }
      lastSavedRef.current = snapshot;
      onDraftStatusChange("saved");
    } catch {
      onDraftStatusChange("error");
    }
  }, [from, to, cc, bcc, subject, body, attachments, buildPayload, draftUid, onDraftUidChange, onDraftStatusChange, createDraft, updateDraft]);

  // Déclenche l'auto-save 5s après un changement.
  const scheduleAutosave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveDraft(), 5000);
  }, [saveDraft]);

  const handleChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    scheduleAutosave();
  };
  const handleBodyChange = (html: string) => { setBody(html); scheduleAutosave(); };

  // Sauvegarde manuelle immédiate (force la sauvegarde même si snapshot identique).
  const handleSaveDraft = async () => {
    if (!subject && !body && !to && attachments.length === 0) {
      toast.error("Rien à sauvegarder");
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSavingDraft(true);
    // Force la sauvegarde en ignorant le snapshot.
    lastSavedRef.current = "";
    try {
      await saveDraft();
      toast.success("Brouillon enregistré");
    } catch {
      toast.error("Erreur lors de l'enregistrement du brouillon");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim()) {
      toast.error("Veuillez saisir au moins un destinataire");
      return;
    }
    if (!subject.trim()) {
      toast.error("Veuillez saisir un sujet");
      return;
    }
    setSubmitting(true);
    // Anti-double-submit.
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    let payload = buildPayload();

    if (pgpEncrypt || pgpSign) {
      const processed = await processPgpPayload({
        recipients: payload.to,
        plainText: payload.text || htmlToText(body),
      });
      if (processed === "") {
        setSubmitting(false);
        return;
      }
      if (processed) {
        payload = { ...payload, text: processed, html: `<pre>${processed}</pre>` };
      }
    }

    if (undoSendDelay > 0) {
      setSubmitting(false);
      // Fermeture immédiate du panneau de composition
      onClose();

      const recipientText =
        payload.to[0] + (payload.to.length > 1 ? ` (+${payload.to.length - 1})` : "");

      queueSend({
        accountId,
        payload,
        mode,
        replyTo,
        draftUid,
        attachments,
        recipientPreview: recipientText,
        subjectPreview: payload.subject,
        totalDurationMs: undoSendDelay * 1000,
        onExecute: async () => {
          try {
            await sendEmail.mutateAsync(payload);
            if (draftUid) {
              deleteDraft.mutate(draftUid);
            }
            toast.success("Message envoyé avec succès");
          } catch (err) {
            if (err instanceof ApiError) toast.error(`Échec : ${err.message}`);
            else toast.error("Échec lors de l'envoi du message");
          }
        },
      });
      return;
    }

    try {
      await sendEmail.mutateAsync(payload);
      toast.success("Message envoyé");
      onSent();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Erreur lors de l'envoi");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectTemplate = (template: EmailTemplate) => {
    if (!subject.trim() && template.subject) {
      setSubject(template.subject);
    }
    const newBody = body ? `${body}<br><br>${template.bodyHtml}` : template.bodyHtml;
    setBody(newBody);
    handleBodyChange(newBody);
    toast.success(`Modèle "${template.title}" inséré`);
  };

  return (
    <form onSubmit={handleSend} className="flex h-full flex-col gap-4">
      <ComposeRecipients
        currentAccount={currentAccount}
        from={from}
        onFromChange={setFrom}
        to={to}
        onToChange={setTo}
        cc={cc}
        onCcChange={handleChange(setCc)}
        bcc={bcc}
        onBccChange={handleChange(setBcc)}
        subject={subject}
        onSubjectChange={handleChange(setSubject)}
        showCcBcc={showCcBcc}
        onToggleCcBcc={() => setShowCcBcc((v) => !v)}
      />

      {/* Éditeur de texte riche */}
      <div className="flex min-h-[35vh] flex-1 flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Message</Label>
          <Button type="button" variant="ghost" size="xs" onClick={handleInsertSignature} className="text-[11px] text-muted-foreground hover:text-primary h-auto py-0.5 px-1.5" title="Insérer la signature de courtoisie">
            Insérer ma signature
          </Button>
        </div>
        <RichTextEditor
          value={body}
          onChange={handleBodyChange}
          placeholder="Écrivez votre message..."
          accountId={accountId}
          onTemplateInserted={(t) => { if (!subject.trim() && t.subject) setSubject(t.subject); }}
        />
      </div>

      {/* Zone de pièces jointes */}
      <AttachmentDropzone
        attachments={attachments}
        onChange={(atts) => {
          setAttachments(atts);
          scheduleAutosave();
        }}
      />

      <ComposeActions
        submitting={submitting}
        savingDraft={savingDraft}
        requestReadReceipt={requestReadReceipt}
        onRequestReadReceiptChange={setRequestReadReceipt}
        onSaveDraft={handleSaveDraft}
        onCancel={onClose}
        accountId={accountId}
        onSelectTemplate={handleSelectTemplate}
        onOpenSchedule={() => setScheduleDialogOpen(true)}
        onOpenScheduledList={() => setScheduledListDialogOpen(true)}
        pgpEncrypt={pgpEncrypt}
        onPgpEncryptChange={setPgpEncrypt}
        pgpSign={pgpSign}
        onPgpSignChange={setPgpSign}
      />

      {/* Dialogues de planification Send Later */}
      <ScheduleSendDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        onSchedule={(date) => scheduleSend(date, buildPayload())}
      />
      <ScheduledMessagesDialog
        open={scheduledListDialogOpen}
        onOpenChange={setScheduledListDialogOpen}
        accountId={accountId}
      />
    </form>
  );
}
