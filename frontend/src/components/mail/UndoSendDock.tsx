"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useUndoSendStore, type PendingSendItem } from "@/lib/stores/undoSendStore";
import { useUIStore } from "@/lib/stores/uiStore";
import { Button } from "@/components/ui/button";
import { Send, Undo2, Loader2, FastForward } from "lucide-react";
import { toast } from "sonner";

/**
 * Dock flottant d'annulation d'envoi ("Undo Send").
 * Affiche un compte à rebours interactif, une jauge de progression,
 * un bouton "Annuler" (raccourci Z) et "Envoyer maintenant".
 */
export function UndoSendDock() {
  const pendingSend = useUndoSendStore((s) => s.pendingSend);

  if (!pendingSend) return null;

  return <UndoSendDockContent key={pendingSend.id} pendingSend={pendingSend} />;
}

interface UndoSendDockContentProps {
  pendingSend: PendingSendItem;
}

function UndoSendDockContent({ pendingSend }: UndoSendDockContentProps) {
  const cancelPendingSend = useUndoSendStore((s) => s.cancelPendingSend);
  const confirmPendingSend = useUndoSendStore((s) => s.confirmPendingSend);
  const openCompose = useUIStore((s) => s.openCompose);

  const [remainingMs, setRemainingMs] = useState(pendingSend.totalDurationMs);
  const [isExecuting, setIsExecuting] = useState(false);
  const rafRef = useRef<number | null>(null);

  // Mise à jour continue du décompte via requestAnimationFrame
  useEffect(() => {
    const updateTimer = () => {
      const diff = pendingSend.expiresAt - Date.now();
      if (diff <= 0) {
        setRemainingMs(0);
        setIsExecuting(true);
        confirmPendingSend();
      } else {
        setRemainingMs(diff);
        rafRef.current = requestAnimationFrame(updateTimer);
      }
    };

    rafRef.current = requestAnimationFrame(updateTimer);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [pendingSend, confirmPendingSend]);

  // Protection contre la fermeture d'onglet pendant l'envoi différé
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Action d'annulation
  const handleUndo = useCallback(() => {
    if (isExecuting) return;
    const mode = pendingSend.mode;
    const replyTo = pendingSend.replyTo;
    const restored = cancelPendingSend();

    if (restored) {
      openCompose(mode, replyTo, restored);
      toast.info("Envoi annulé. Votre message a été rouvert.");
    }
  }, [pendingSend, isExecuting, cancelPendingSend, openCompose]);

  // Raccourci clavier Z / Ctrl+Z pour annuler
  useEffect(() => {
    if (isExecuting) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if ((e.key === "z" || e.key === "Z") && !isInput) {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExecuting, handleUndo]);

  const total = pendingSend.totalDurationMs || 5000;
  const progressPercent = Math.max(0, Math.min(100, (remainingMs / total) * 100));
  const remainingSec = Math.ceil(remainingMs / 1000);

  return (
    <aside
      aria-label="Confirmation d'envoi"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center select-none animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      <div className="relative overflow-hidden flex items-center gap-3.5 px-4 py-3 rounded-xl border border-border/80 bg-card/95 backdrop-blur-md shadow-2xl min-w-[340px] sm:min-w-[420px] max-w-[90vw]">
        {/* Jauge de progression animée en arrière-plan */}
        <div
          className="absolute bottom-0 left-0 h-1 bg-primary/80 transition-all duration-75 ease-linear"
          style={{ width: `${progressPercent}%` }}
        />

        {/* Icône de statut */}
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {isExecuting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4 animate-pulse" />
          )}
        </div>

        {/* Texte informatif */}
        <div className="flex flex-1 flex-col min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground truncate">
              {isExecuting
                ? "Expédition en cours..."
                : `Envoi à ${pendingSend.recipientPreview}`}
            </span>
            {!isExecuting && remainingSec > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/60">
                {remainingSec}s
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            {pendingSend.subjectPreview || "(Sans objet)"}
          </p>
        </div>

        {/* Boutons d'action */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleUndo}
            disabled={isExecuting}
            className="h-7 px-2.5 text-xs font-medium gap-1 cursor-pointer shadow-xs"
            title="Annuler l'envoi (Raccourci Z)"
          >
            <Undo2 className="size-3.5" />
            <span>Annuler</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={confirmPendingSend}
            disabled={isExecuting}
            className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Envoyer immédiatement"
          >
            <FastForward className="size-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
