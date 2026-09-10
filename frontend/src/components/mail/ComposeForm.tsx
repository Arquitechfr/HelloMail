"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import DOMPurify from "dompurify";
import { useSendEmail } from "@/lib/queries/messages";
import { useCreateDraft, useUpdateDraft, useDeleteDraft } from "@/lib/queries/drafts";
import { useAccounts } from "@/lib/queries/accounts";
import { useUndoSendStore, type RestoredComposeData } from "@/lib/stores/undoSendStore";
import { htmlToText, formatSignatureHtml } from "@/lib/compose-utils";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/mail/RichTextEditor";
import { ComposeRecipients } from "@/components/mail/ComposeRecipients";
import { ComposeActions } from "@/components/mail/ComposeActions";
import { AttachmentDropzone, type AttachmentItem } from "@/components/mail/AttachmentDropzone";
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

  const [to, setTo] = useState(
    restoredData?.to ?? (replyTo && mode === "reply" ? replyTo.from ?? "" : ""),
  );
  const [cc, setCc] = useState(restoredData?.cc ?? "");
  const [bcc, setBcc] = useState(restoredData?.bcc ?? "");
  const [subject, setSubject] = useState(initialSubject());
  const [body, setBody] = useState<string>(restoredData?.body ?? replyTo?.html ?? "");
  const [attachments, setAttachments] = useState<AttachmentItem[]>(
    restoredData?.attachments ?? [],
  );
  const [requestReadReceipt, setRequestReadReceipt] = useState(
    restoredData?.requestReadReceipt ?? false,
  );
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(!!(restoredData?.cc || restoredData?.bcc));
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

  const { data: accounts } = useAccounts();
  const currentAccount = accounts?.find((a) => a._id === accountId);

  const handleInsertSignature = useCallback(() => {
    if (!currentAccount) return;
    const sigText =
      currentAccount.signature?.text?.trim() ||
      `-- \nBien cordialement,\n${currentAccount.displayName || currentAccount.emailAddress}`;
    const sigHtml =
      currentAccount.signature?.html || formatSignatureHtml(sigText);

    setBody((prev) => {
      const significantLine =
        sigText
          .split("\n")
          .map((l) => l.trim())
          .find((l) => l && !l.startsWith("-")) || sigText;

      if (prev && prev.includes(significantLine)) {
        toast.info("La signature est déjà présente dans le message");
        return prev;
      }
      return prev && prev !== "<p></p>" ? `${prev}${sigHtml}` : `<p></p>${sigHtml}`;
    });
    toast.success("Signature insérée");
  }, [currentAccount]);

  // Insertion automatique de la signature si activée et nouveau message
  const signatureInsertedRef = useRef(!!restoredData);
  useEffect(() => {
    if (
      mode === "new" &&
      currentAccount?.signature?.enabled &&
      !body &&
      !signatureInsertedRef.current
    ) {
      signatureInsertedRef.current = true;
      const sigText =
        currentAccount.signature.text?.trim() ||
        `-- \nBien cordialement,\n${currentAccount.displayName || currentAccount.emailAddress}`;
      const sigHtml =
        currentAccount.signature.html || formatSignatureHtml(sigText);
      setBody(`<p></p>${sigHtml}`);
    }
  }, [mode, currentAccount, body]);

  // Auto-save avec debounce 5s.
  const saveDraft = useCallback(async () => {
    if (!subject && !body && !to) return;
    const snapshot = JSON.stringify({ to, cc, bcc, subject, body });
    if (snapshot === lastSavedRef.current) return;

    onDraftStatusChange("saving");
    const draftBody: SendEmailInput = {
      to: to.split(",").map((s) => s.trim()).filter(Boolean),
      cc: cc ? cc.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      bcc: bcc ? bcc.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      subject,
      text: htmlToText(body),
      html: DOMPurify.sanitize(body),
      inReplyTo: mode === "reply" ? replyTo?.messageId : undefined,
      references: mode === "reply" && replyTo?.messageId ? [replyTo.messageId] : undefined,
    };

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
  }, [to, cc, bcc, subject, body, mode, replyTo, draftUid, onDraftUidChange, onDraftStatusChange, createDraft, updateDraft]);

  // Déclenche l'auto-save 5s après un changement.
  const scheduleAutosave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveDraft(), 5000);
  }, [saveDraft]);

  const handleChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    scheduleAutosave();
  };

  const handleBodyChange = (html: string) => {
    setBody(html);
    scheduleAutosave();
  };

  // Sauvegarde manuelle immédiate (force la sauvegarde même si snapshot identique).
  const handleSaveDraft = async () => {
    if (!subject && !body && !to) {
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

    // Sanitization HTML côté frontend (défense en profondeur).
    const html = DOMPurify.sanitize(body);

    const payload: SendEmailInput = {
      to: to.split(",").map((s) => s.trim()).filter(Boolean),
      cc: cc ? cc.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      bcc: bcc ? bcc.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      subject,
      text: htmlToText(body),
      html,
      attachments:
        attachments.length > 0
          ? attachments.map((a) => ({
              filename: a.filename,
              content: a.content,
              contentType: a.contentType,
            }))
          : undefined,
      inReplyTo: mode === "reply" ? replyTo?.messageId : undefined,
      references: mode === "reply" && replyTo?.messageId ? [replyTo.messageId] : undefined,
      requestReadReceipt: requestReadReceipt ? true : undefined,
    };

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
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleInsertSignature}
            className="text-[11px] text-muted-foreground hover:text-primary h-auto py-0.5 px-1.5"
            title="Insérer la signature de courtoisie"
          >
            Insérer ma signature
          </Button>
        </div>
        <RichTextEditor value={body} onChange={handleBodyChange} placeholder="Écrivez votre message..." />
      </div>

      {/* Zone de pièces jointes */}
      <AttachmentDropzone attachments={attachments} onChange={setAttachments} />

      <ComposeActions
        submitting={submitting}
        savingDraft={savingDraft}
        requestReadReceipt={requestReadReceipt}
        onRequestReadReceiptChange={setRequestReadReceipt}
        onSaveDraft={handleSaveDraft}
        onCancel={onClose}
        accountId={accountId}
        onSelectTemplate={handleSelectTemplate}
      />
    </form>
  );
}
