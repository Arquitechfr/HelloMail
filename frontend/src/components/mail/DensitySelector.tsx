"use client";

import { Check, Rows3 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUIStore } from "@/lib/stores/uiStore";
import { useUpdatePreferences } from "@/lib/queries/auth";
import { DISPLAY_DENSITIES, type DisplayDensity } from "@/lib/types/display";

export function DensitySelector() {
  const density = useUIStore((s) => s.displayDensity);
  const setDensity = useUIStore((s) => s.setDisplayDensity);
  const updatePreferences = useUpdatePreferences();

  const handleSelect = (nextDensity: DisplayDensity) => {
    if (nextDensity === density) return;
    setDensity(nextDensity);
    updatePreferences.mutate({ displayDensity: nextDensity });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary"
        title="Densité d'affichage de la liste"
        aria-label="Densité d'affichage de la liste"
      >
        <Rows3 className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-display">
          Densité d&apos;affichage
        </div>
        {DISPLAY_DENSITIES.map((opt) => (
          <DropdownMenuItem
            key={opt.id}
            onClick={() => handleSelect(opt.id)}
            className="flex items-center justify-between text-xs cursor-pointer py-1.5"
          >
            <div className="flex flex-col">
              <span className="font-medium text-foreground">{opt.label}</span>
              <span className="text-[10px] text-muted-foreground">{opt.height}px</span>
            </div>
            {density === opt.id && <Check className="size-3.5 text-primary shrink-0 ml-2" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
