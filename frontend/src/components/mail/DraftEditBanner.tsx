"use client";

import { Button } from "@/components/ui/button";
import { FileEdit, Pencil } from "lucide-react";

interface DraftEditBannerProps {
  onEditDraft: () => void;
}

export function DraftEditBanner({ onEditDraft }: DraftEditBannerProps) {
  return (
    <div className="mx-6 mt-3 mb-1 flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-amber-950 dark:text-amber-200 no-print">
      <div className="flex items-center gap-2.5 min-w-0">
        <FileEdit className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold">Ceci est un brouillon non envoyé</p>
          <p className="text-[11px] text-muted-foreground truncate">
            Vous pouvez reprendre la rédaction et l&apos;envoyer à tout moment.
          </p>
        </div>
      </div>
      <Button
        size="sm"
        onClick={onEditDraft}
        className="gap-1.5 h-7 px-2.5 text-xs font-medium shrink-0 cursor-pointer"
      >
        <Pencil className="size-3.5" />
        <span>Reprendre la rédaction</span>
      </Button>
    </div>
  );
}
