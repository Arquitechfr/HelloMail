"use client";

import { useUndoSendStore } from "@/lib/stores/undoSendStore";
import { useUpdatePreferences } from "@/lib/queries/auth";
import { useAuthStore } from "@/lib/stores/authStore";
import { useEffect } from "react";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DELAY_OPTIONS = [
  { value: 0, label: "Immédiat (0s)" },
  { value: 5, label: "5s (Recommandé)" },
  { value: 10, label: "10s" },
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
];

export function UndoSendSettings() {
  const { undoSendDelay, setUndoSendDelay } = useUndoSendStore();
  const updatePreferences = useUpdatePreferences();
  const user = useAuthStore((s) => s.user);

  // Synchronise avec les préférences utilisateur backend si présentes
  useEffect(() => {
    if (user?.preferences?.undoSendDelay !== undefined) {
      setUndoSendDelay(user.preferences.undoSendDelay);
    }
  }, [user?.preferences?.undoSendDelay, setUndoSendDelay]);

  const handleSelectDelay = async (delay: number) => {
    setUndoSendDelay(delay);
    try {
      await updatePreferences.mutateAsync({ undoSendDelay: delay });
      toast.success(
        delay === 0
          ? "Annulation d'envoi désactivée (envoi direct)"
          : `Délai d'annulation d'envoi réglé à ${delay} secondes`,
      );
    } catch {
      toast.error("Erreur lors de la sauvegarde du réglage");
    }
  };

  return (
    <div className="flex flex-col gap-3 py-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Undo2 className="size-3.5 text-primary" />
            <span className="text-xs font-medium text-foreground">
              Annulation d&apos;envoi (&quot;Undo Send&quot;)
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Délai accordé pour interrompre l&apos;expédition d&apos;un email après avoir cliqué sur Envoyer.
          </p>
        </div>
      </div>

      {/* Sélecteur de délai segmenté */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-muted/40 border border-border/60 max-w-fit">
        {DELAY_OPTIONS.map((opt) => {
          const isSelected = undoSendDelay === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelectDelay(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer select-none",
                isSelected
                  ? "bg-background text-foreground shadow-xs font-semibold border border-border/80"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
