"use client";

import { Check, Rows3, StretchHorizontal, AlignJustify } from "lucide-react";
import { useUIStore } from "@/lib/stores/uiStore";
import { useUpdatePreferences } from "@/lib/queries/auth";
import { DISPLAY_DENSITIES, type DisplayDensity } from "@/lib/types/display";

const DENSITY_ICONS: Record<DisplayDensity, typeof Rows3> = {
  compact: AlignJustify,
  comfortable: Rows3,
  spacious: StretchHorizontal,
};

export function DisplayDensitySettings() {
  const currentDensity = useUIStore((s) => s.displayDensity);
  const setDensity = useUIStore((s) => s.setDisplayDensity);
  const updatePreferences = useUpdatePreferences();

  const handleSelect = (density: DisplayDensity) => {
    if (density === currentDensity) return;
    setDensity(density);
    updatePreferences.mutate({ displayDensity: density });
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider font-display">
          Densité de la liste des messages
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ajustez la hauteur des lignes et le niveau de détail affiché dans la liste des emails.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {DISPLAY_DENSITIES.map((opt) => {
          const isSelected = currentDensity === opt.id;
          const Icon = DENSITY_ICONS[opt.id];

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt.id)}
              className={`flex flex-col text-left p-3 rounded-lg border transition-all relative ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-xs"
                  : "border-border/60 hover:border-border bg-card/40 hover:bg-card/70"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-md ${
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="size-4" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                </div>
                {isSelected && <Check className="size-4 text-primary shrink-0" />}
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed flex-1">
                {opt.description}
              </p>

              <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                <span>Hauteur de ligne</span>
                <span className="font-semibold text-foreground">{opt.height}px</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
