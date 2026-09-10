"use client";

import { useState, useRef, useCallback } from "react";
import DOMPurify from "dompurify";
import { useSendEmail } from "@/lib/queries/messages";
import { useCreateDraft, useUpdateDraft } from "@/lib/queries/drafts";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/mail/RichTextEditor";
import { Loader2, Send, ChevronDown, ChevronUp, Save, X } from "lucide-react";
import { toast } from "sonner";
import type { SendEmailInput } from "@/lib/api-types";

export type DraftStatus = "idle" | "saving" | "saved" | "error";

interface ComposeFormProps {
  accountId: string;
  mode: "new" | "reply" | "forward";
  replyTo?: { messageId?: string; subject?: string; from?: string; to?: string[] } | null;
  draftUid: number | null;
  onDraftUidChange: (uid: number | null) => void;
  onDraftStatusChange: (status: DraftStatus) => void;
  onSent: () => void;
  onClose: () => void;
}

/** Convertit du HTML en texte brut (pour le champ `text` de l'email). */
function htmlToText(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]*>/g, "");
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

export function ComposeForm({
  accountId,
  mode,
  replyTo,
  draftUid,
  onDraftUidChange,
  onDraftStatusChange,
  onSent,
  onClose,
}: ComposeFormProps) {
  const sendEmail = useSendEmail(accountId);
  const createDraft = useCreateDraft(accountId);
  const updateDraft = useUpdateDraft(accountId);

  const initialSubject = () => {
    if (mode === "reply" && replyTo?.subject) {
      return replyTo.subject.startsWith("Re:") ? replyTo.subject : `Re: ${replyTo.subject}`;
    }
    if (mode === "forward" && replyTo?.subject) {
      return replyTo.subject.startsWith("Fwd:") ? replyTo.subject : `Fwd: ${replyTo.subject}`;
    }
    return "";
  };

  const [to, setTo] = useState(replyTo && mode === "reply" ? replyTo.from ?? "" : "");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(initialSubject());
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

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
      inReplyTo: mode === "reply" ? replyTo?.messageId : undefined,
      references: mode === "reply" && replyTo?.messageId ? [replyTo.messageId] : undefined,
    };

    try {
      await sendEmail.mutateAsync(payload);
      toast.success("Message envoyé");
      // Supprime le brouillon associé si existant.
      onSent();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Erreur lors de l'envoi");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSend} className="flex h-full flex-col gap-4">
      {/* Destinataire + toggle Cc/Cci */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="to">À</Label>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setShowCcBcc((v) => !v)}
            className="text-xs text-muted-foreground"
          >
            {showCcBcc ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            Cc / Cci
          </Button>
        </div>
        <Input id="to" value={to} onChange={handleChange(setTo)} placeholder="destinataire@exemple.com" required />
      </div>

      {/* Cc / Cci (conditionnels) */}
      {showCcBcc && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cc">Cc</Label>
            <Input id="cc" value={cc} onChange={handleChange(setCc)} placeholder="(optionnel)" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bcc">Cci</Label>
            <Input id="bcc" value={bcc} onChange={handleChange(setBcc)} placeholder="(optionnel)" />
          </div>
        </>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="subject">Sujet</Label>
        <Input id="subject" value={subject} onChange={handleChange(setSubject)} placeholder="Sujet du message" required />
      </div>

      {/* Éditeur de texte riche */}
      <div className="flex min-h-[40vh] flex-1 flex-col gap-2">
        <Label>Message</Label>
        <RichTextEditor value={body} onChange={handleBodyChange} placeholder="Écrivez votre message..." />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Envoyer
          </Button>
          <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={savingDraft || submitting}>
            {savingDraft ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Enregistrer
          </Button>
        </div>
        <Button type="button" variant="ghost" onClick={onClose} disabled={submitting || savingDraft}>
          <X className="size-4" />
          Annuler
        </Button>
      </div>
    </form>
  );
}
