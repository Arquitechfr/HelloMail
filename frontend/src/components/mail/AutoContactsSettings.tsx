"use client";

import { useUpdatePreferences } from "@/lib/queries/auth";
import { useAuthStore } from "@/lib/stores/authStore";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Bascule "Contacts automatiques" : ajoute les expéditeurs des emails
 * entrants au carnet d'adresses (opt-in, préférence `autoAddContacts`).
 */
export function AutoContactsSettings() {
  const user = useAuthStore((s) => s.user);
  const updatePreferences = useUpdatePreferences();
  const pref = user?.preferences?.autoAddContacts ?? false;
  const [enabled, setEnabled] = useState(pref);
  const [prevPref, setPrevPref] = useState(pref);

  // Synchronise avec la préférence backend (ajustement pendant le rendu).
  if (prevPref !== pref) {
    setPrevPref(pref);
    setEnabled(pref);
  }

  const handleToggle = async () => {
    const next = !enabled;
    setEnabled(next);
    try {
      await updatePreferences.mutateAsync({ autoAddContacts: next });
      toast.success(
        next
          ? "Contacts automatiques activés — les expéditeurs seront ajoutés au carnet"
          : "Contacts automatiques désactivés",
      );
    } catch {
      setEnabled(!next);
      toast.error("Erreur lors de la sauvegarde du réglage");
    }
  };

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-start gap-2">
        <UserPlus className="size-3.5 text-primary mt-0.5" />
        <div>
          <span className="text-xs font-medium text-foreground">Contacts automatiques</span>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Ajoute les expéditeurs des emails reçus au carnet d&apos;adresses.
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Contacts automatiques"
        onClick={handleToggle}
        disabled={updatePreferences.isPending}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border transition-colors cursor-pointer disabled:opacity-50",
          enabled ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "inline-block size-3.5 rounded-full bg-background shadow transition-transform",
            enabled ? "translate-x-4.5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
