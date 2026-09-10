"use client";

import { useEffect, useState } from "react";
import { ComposeForm, type DraftStatus } from "@/components/mail/ComposeForm";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/lib/stores/uiStore";
import { useDeleteDraft } from "@/lib/queries/drafts";
import { Loader2, Check, AlertCircle, X } from "lucide-react";

/**
 * Panneau de composition plein écran (hors sidebar) remplaçant le modal.
 * Affiché quand `composeOpen` est true, occupe toute la zone à droite de la sidebar.
 */
export function ComposePanel() {
  const {
    composeOpen,
    composeMode,
    composeReplyTo,
    composeRestoredData,
    selectedAccountId,
    closeCompose,
  } = useUIStore();
  const [draftUid, setDraftUid] = useState<number | null>(
    () => composeRestoredData?.draftUid ?? null,
  );
  const [prevRestoredData, setPrevRestoredData] = useState(composeRestoredData);
  if (composeRestoredData !== prevRestoredData) {
    setPrevRestoredData(composeRestoredData);
    setDraftUid(composeRestoredData?.draftUid ?? null);
  }
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
  const [formKey, setFormKey] = useState(0);
  const deleteDraft = useDeleteDraft(selectedAccountId ?? "");

  const handleClose = () => {
    closeCompose();
    setDraftUid(null);
    setDraftStatus("idle");
    setFormKey((k) => k + 1);
  };

  const handleSent = () => {
    if (draftUid) {
      deleteDraft.mutate(draftUid);
    }
    closeCompose();
    setDraftUid(null);
    setDraftStatus("idle");
    setFormKey((k) => k + 1);
  };

  // Fermeture via Escape (remplace le focus trap du Dialog).
  useEffect(() => {
    if (!composeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composeOpen]);

  if (!composeOpen || !selectedAccountId) return null;

  return (
    <div className="flex flex-1 flex-col h-full bg-background overflow-hidden select-text">
      {/* En-tête : titre + bouton fermer */}
      <div className="flex items-center justify-between border-b border-border px-6 py-2.5 bg-background/80 shrink-0">
        <h2 className="text-sm font-bold tracking-tight font-display text-foreground">
          {composeMode === "reply" ? "Répondre" : composeMode === "forward" ? "Transférer" : "Nouveau message"}
        </h2>
        <Button variant="ghost" size="icon-sm" onClick={handleClose} aria-label="Fermer" title="Fermer (Échap)">
          <X className="size-4" />
        </Button>
      </div>

      {/* Indicateur statut brouillon */}
      {draftStatus !== "idle" && (
        <div className="flex items-center gap-2 px-6 pt-3 text-xs text-muted-foreground">
          {draftStatus === "saving" && (
            <>
              <Loader2 className="size-3 animate-spin" />
              Brouillon en cours d&apos;enregistrement...
            </>
          )}
          {draftStatus === "saved" && (
            <>
              <Check className="size-3 text-green-500" />
              Brouillon enregistré
            </>
          )}
          {draftStatus === "error" && (
            <>
              <AlertCircle className="size-3 text-destructive" />
              Erreur lors de l&apos;enregistrement du brouillon
            </>
          )}
        </div>
      )}

      {/* Corps scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <ComposeForm
          key={formKey}
          accountId={selectedAccountId}
          mode={composeMode}
          replyTo={composeReplyTo}
          restoredData={composeRestoredData}
          draftUid={draftUid}
          onDraftUidChange={setDraftUid}
          onDraftStatusChange={setDraftStatus}
          onSent={handleSent}
          onClose={handleClose}
        />
      </div>
    </div>
  );
}
