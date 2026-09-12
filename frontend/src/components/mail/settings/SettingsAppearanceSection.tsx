"use client";

import { ThemeToggle } from "@/components/mail/ThemeToggle";
import { UndoSendSettings } from "@/components/mail/UndoSendSettings";
import { AutoContactsSettings } from "@/components/mail/AutoContactsSettings";
import { DisplayDensitySettings } from "@/components/mail/settings/DisplayDensitySettings";
import { SwipeActionsSettings } from "@/components/mail/settings/SwipeActionsSettings";
import { SmartAssistanceSettings } from "@/components/mail/settings/SmartAssistanceSettings";
import { Sliders, SunMoon, Radio } from "lucide-react";

export function SettingsAppearanceSection() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Carte 1 : Thème & Apparence */}
        <div className="rounded-lg border border-border bg-card/60 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/50">
              <SunMoon className="size-4 text-primary" />
              <h2 className="text-sm font-bold font-display text-foreground">
                Thème & Affichage
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Personnalisez l&apos;ambiance visuelle d&apos;Mailora. Le thème Obsidian offre un contraste optimisé pour réduire la fatigue oculaire.
            </p>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-md bg-muted/20 border border-border/40">
            <div>
              <span className="text-xs font-medium text-foreground">Palette de couleurs</span>
              <p className="text-[11px] text-muted-foreground">Mode Clair ou Sombre Obsidian</p>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Carte 2 : Synchronisation & Flux SSE */}
        <div className="rounded-lg border border-border bg-card/60 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/50">
              <Radio className="size-4 text-primary" />
              <h2 className="text-sm font-bold font-display text-foreground">
                Temps Réel & Synchronisation
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Mise à jour instantanée de vos boîtes de réception via le canal Server-Sent Events (SSE) et Redis Pub/Sub.
            </p>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-md bg-muted/20 border border-border/40">
            <div>
              <span className="text-xs font-medium text-foreground">Canal SSE permanent</span>
              <p className="text-[11px] text-muted-foreground">Réception des emails et alertes sans polling</p>
            </div>
            <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              Connecté
            </span>
          </div>
        </div>
      </div>

      {/* Carte 3 : Annulation d'envoi ("Undo Send") */}
      <div className="rounded-lg border border-border bg-card/60 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/50">
          <Sliders className="size-4 text-primary" />
          <h2 className="text-sm font-bold font-display text-foreground">
            Comportement
          </h2>
        </div>
        <UndoSendSettings />
        <div className="border-t border-border/40">
          <AutoContactsSettings />
        </div>
        <div className="border-t border-border/40">
          <SmartAssistanceSettings />
        </div>
      </div>

      {/* Carte 4 : Densité & Gestes tactiles (Phase 27) */}
      <div className="rounded-lg border border-border bg-card/60 shadow-xs overflow-hidden">
        <DisplayDensitySettings />
        <div className="border-t border-border/40">
          <SwipeActionsSettings />
        </div>
      </div>
    </div>
  );
}
