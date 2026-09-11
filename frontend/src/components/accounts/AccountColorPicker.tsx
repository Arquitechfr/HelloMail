"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const ACCOUNT_COLOR_PALETTE = [
  { hex: "#3b82f6", label: "Bleu" },
  { hex: "#8b5cf6", label: "Violet" },
  { hex: "#10b981", label: "Émeraude" },
  { hex: "#f59e0b", label: "Ambre" },
  { hex: "#ec4899", label: "Rose" },
  { hex: "#06b6d4", label: "Cyan" },
  { hex: "#f97316", label: "Orange" },
  { hex: "#6366f1", label: "Indigo" },
  { hex: "#14b8a6", label: "Sarcelle" },
  { hex: "#84cc16", label: "Lime" },
  { hex: "#a855f7", label: "Pourpre" },
  { hex: "#ef4444", label: "Rouge" },
];

interface AccountColorPickerProps {
  currentColor?: string;
  usedColors?: string[];
  onSelectColor: (color: string) => void;
  className?: string;
}

export function AccountColorPicker({
  currentColor = "#3b82f6",
  usedColors = [],
  onSelectColor,
  className,
}: AccountColorPickerProps) {
  const currentNormalized = currentColor.toLowerCase();
  const usedNormalized = new Set(usedColors.map((c) => c.toLowerCase()));

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="grid grid-cols-6 gap-2">
        {ACCOUNT_COLOR_PALETTE.map(({ hex, label }) => {
          const isSelected = currentNormalized === hex.toLowerCase();
          const isTaken = !isSelected && usedNormalized.has(hex.toLowerCase());

          return (
            <button
              key={hex}
              type="button"
              onClick={() => onSelectColor(hex)}
              title={`${label}${isTaken ? " (utilisé par un autre compte)" : ""}`}
              className={cn(
                "group relative flex size-7 items-center justify-center rounded-full transition-transform hover:scale-110 focus:outline-hidden",
                isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                isTaken && "opacity-60",
              )}
              style={{ backgroundColor: hex }}
            >
              {isSelected && <Check className="size-3.5 text-white drop-shadow-xs" />}
              {isTaken && (
                <span className="absolute -top-1 -right-1 size-2 rounded-full border border-background bg-muted-foreground" />
              )}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        La couleur attribuée sera appliquée à l'ensemble des dossiers de ce compte.
      </p>
    </div>
  );
}
