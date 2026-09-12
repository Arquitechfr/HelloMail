"use client";

import { Paperclip, Sparkles } from "lucide-react";
import { useUIStore } from "@/lib/stores/uiStore";
import { useUpdatePreferences } from "@/lib/queries/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function SmartAssistanceSettings() {
  const attachmentEnabled = useUIStore((s) => s.attachmentReminderEnabled);
  const setAttachmentEnabled = useUIStore((s) => s.setAttachmentReminderEnabled);
  const smartRepliesEnabled = useUIStore((s) => s.smartRepliesEnabled);
  const setSmartRepliesEnabled = useUIStore((s) => s.setSmartRepliesEnabled);
  const updatePreferences = useUpdatePreferences();

  const handleToggleAttachment = async () => {
    const next = !attachmentEnabled;
    setAttachmentEnabled(next);
    try {
      await updatePreferences.mutateAsync({ attachmentReminderEnabled: next });
      toast.success(
        next
          ? "Alerte de pièce jointe activée"
          : "Alerte de pièce jointe désactivée",
      );
    } catch {
      setAttachmentEnabled(!next);
      toast.error("Erreur lors de la sauvegarde du réglage");
    }
  };

  const handleToggleSmartReplies = async () => {
    const next = !smartRepliesEnabled;
    setSmartRepliesEnabled(next);
    try {
      await updatePreferences.mutateAsync({ smartRepliesEnabled: next });
      toast.success(
        next
          ? "Réponses rapides suggérées activées"
          : "Réponses rapides suggérées désactivées",
      );
    } catch {
      setSmartRepliesEnabled(!next);
      toast.error("Erreur lors de la sauvegarde du réglage");
    }
  };

  return (
    <div className="space-y-3 py-3">
      {/* Bascule 1 : Détection d'oubli de pièces jointes */}
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-2">
          <Paperclip className="size-3.5 text-primary mt-0.5" />
          <div>
            <span className="text-xs font-medium text-foreground">
              Alerte de pièce jointe oubliée
            </span>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Avertit avant l&apos;envoi si le texte mentionne une pièce jointe absente.
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={attachmentEnabled}
          aria-label="Alerte de pièce jointe oubliée"
          onClick={handleToggleAttachment}
          disabled={updatePreferences.isPending}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border transition-colors cursor-pointer disabled:opacity-50",
            attachmentEnabled ? "bg-primary" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "inline-block size-3.5 rounded-full bg-background transition-transform",
              attachmentEnabled ? "translate-x-4.5" : "translate-x-0.5",
            )}
          />
        </button>
      </div>

      {/* Bascule 2 : Réponses intelligentes rapides */}
      <div className="flex items-center justify-between pt-2 border-t border-border/40">
        <div className="flex items-start gap-2">
          <Sparkles className="size-3.5 text-primary mt-0.5" />
          <div>
            <span className="text-xs font-medium text-foreground">
              Suggestions de réponses rapides (Smart Replies)
            </span>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Propose des réponses en 1 clic analysées 100% localement dans le navigateur.
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={smartRepliesEnabled}
          aria-label="Suggestions de réponses rapides"
          onClick={handleToggleSmartReplies}
          disabled={updatePreferences.isPending}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border transition-colors cursor-pointer disabled:opacity-50",
            smartRepliesEnabled ? "bg-primary" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "inline-block size-3.5 rounded-full bg-background transition-transform",
              smartRepliesEnabled ? "translate-x-4.5" : "translate-x-0.5",
            )}
          />
        </button>
      </div>
    </div>
  );
}
