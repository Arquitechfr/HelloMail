"use client";

import { useEffect, useState } from "react";
import { ComposeForm, type DraftStatus } from "@/components/mail/ComposeForm";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/lib/stores/uiStore";
import { useAccounts } from "@/lib/queries/accounts";
import { useDeleteDraft } from "@/lib/queries/drafts";
import { Loader2, Check, AlertCircle, X, Maximize2, Minimize2, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Fenêtre modale de composition d'email universelle ("Compose Window").
 * S'ouvre instantanément par-dessus n'importe quelle page (boîte, réglages, contacts...)
 * dès que `composeOpen` est activé, sans quitter le contexte actuel.
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
  const { data: accounts } = useAccounts();
  const effectiveAccountId = selectedAccountId || accounts?.[0]?._id || "";

  const [isMaximized, setIsMaximized] = useState(false);
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
  const deleteDraft = useDeleteDraft(effectiveAccountId);

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

  // Fermeture via Escape
  useEffect(() => {
    if (!composeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composeOpen]);

  if (!composeOpen) return null;

  if (!effectiveAccountId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-xs p-4">
        <div className="rounded-xl border border-border bg-card p-6 shadow-2xl max-w-md w-full text-center">
          <Mail className="size-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-foreground font-semibold mb-1">Aucun compte de messagerie lié</p>
          <p className="text-xs text-muted-foreground mb-4">
            Veuillez d&apos;abord ajouter vos identifiants IMAP/SMTP dans les réglages pour pouvoir rédiger des emails.
          </p>
          <Button onClick={handleClose} size="sm" className="cursor-pointer">Fermer</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 select-text">
      {/* Arrière-plan semi-transparent cliquable pour fermer */}
      <div
        className="fixed inset-0 bg-background/60 backdrop-blur-xs animate-in fade-in duration-200"
        onClick={handleClose}
      />

      {/* Fenêtre de composition flottante responsive */}
      <div
        className={cn(
          "relative z-10 flex flex-col bg-card border border-border/90 rounded-xl shadow-2xl overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95",
          isMaximized
            ? "w-full h-full inset-0 rounded-none sm:rounded-xl"
            : "w-full max-w-4xl h-[90vh] max-h-[820px]",
        )}
      >
        {/* En-tête de la fenêtre : titre + statut brouillon + agrandir + fermer */}
        <div className="flex items-center justify-between border-b border-border px-4 sm:px-6 py-2.5 bg-muted/30 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-sm font-bold tracking-tight font-display text-foreground truncate">
              {composeMode === "reply" ? "Répondre" : composeMode === "forward" ? "Transférer" : "Nouveau message"}
            </h2>

            {/* Statut de sauvegarde du brouillon */}
            {draftStatus !== "idle" && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                {draftStatus === "saving" && (
                  <>
                    <Loader2 className="size-3 animate-spin text-primary" />
                    <span>Enregistrement...</span>
                  </>
                )}
                {draftStatus === "saved" && (
                  <>
                    <Check className="size-3 text-emerald-500" />
                    <span className="text-emerald-500">Brouillon sauvé</span>
                  </>
                )}
                {draftStatus === "error" && (
                  <>
                    <AlertCircle className="size-3 text-destructive" />
                    <span className="text-destructive">Erreur brouillon</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsMaximized(!isMaximized)}
              aria-label={isMaximized ? "Réduire" : "Plein écran"}
              title={isMaximized ? "Taille normale" : "Plein écran"}
              className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {isMaximized ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleClose}
              aria-label="Fermer"
              title="Fermer (Échap)"
              className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Corps de rédaction avec le ComposeForm */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          <ComposeForm
            key={formKey}
            accountId={effectiveAccountId}
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
    </div>
  );
}
