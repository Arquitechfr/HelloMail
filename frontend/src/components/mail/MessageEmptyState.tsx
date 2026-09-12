"use client";

import { Mail } from "lucide-react";

export function MessageEmptyState() {
  return (
    <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-card/10 p-8 text-center select-none">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground border border-border mb-3 shadow-xs">
        <Mail className="size-6" />
      </div>
      <h3 className="text-sm font-semibold font-display text-foreground">Aucun message sélectionné</h3>
      <p className="mt-1 text-xs text-muted-foreground max-w-xs">
        Sélectionnez un email dans la liste ou utilisez les raccourcis clavier pour naviguer.
      </p>
      <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1 rounded bg-muted/80 px-1.5 py-0.5 font-mono border border-border">C</span>
        <span>Nouveau message</span>
        <span className="text-border">·</span>
        <span className="flex items-center gap-1 rounded bg-muted/80 px-1.5 py-0.5 font-mono border border-border">?</span>
        <span>Aide raccourcis</span>
      </div>
    </div>
  );
}
