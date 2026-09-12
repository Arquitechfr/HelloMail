"use client";

import { Hand, ArrowRight, ArrowLeft } from "lucide-react";
import { useUIStore } from "@/lib/stores/uiStore";
import { useUpdatePreferences } from "@/lib/queries/auth";
import {
  SWIPE_ACTIONS_RIGHT,
  SWIPE_ACTIONS_LEFT,
  type SwipeAction,
} from "@/lib/types/display";

export function SwipeActionsSettings() {
  const swipeRightAction = useUIStore((s) => s.swipeRightAction);
  const swipeLeftAction = useUIStore((s) => s.swipeLeftAction);
  const setSwipeRightAction = useUIStore((s) => s.setSwipeRightAction);
  const setSwipeLeftAction = useUIStore((s) => s.setSwipeLeftAction);
  const updatePreferences = useUpdatePreferences();

  const handleRightChange = (action: SwipeAction) => {
    setSwipeRightAction(action);
    updatePreferences.mutate({ swipeRightAction: action });
  };

  const handleLeftChange = (action: SwipeAction) => {
    setSwipeLeftAction(action);
    updatePreferences.mutate({ swipeLeftAction: action });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Hand className="size-4 text-primary" />
        <div>
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider font-display">
            Gestes de balayage tactile (Swipe)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configurez les actions rapides déclenchées lors du balayage d&apos;un email sur mobile ou tablette.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Balayage vers la droite */}
        <div className="p-3.5 rounded-lg border border-border/60 bg-card/40 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <div className="p-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ArrowRight className="size-3.5" />
            </div>
            <span>Balayage vers la droite (Swipe Right)</span>
          </div>

          <div className="space-y-1.5">
            {SWIPE_ACTIONS_RIGHT.map((opt) => {
              const isSelected = swipeRightAction === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleRightChange(opt.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors text-left ${
                    isSelected
                      ? "bg-primary/10 text-primary font-medium border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <span>{opt.label}</span>
                  {isSelected && <span className="text-[10px] font-bold">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Balayage vers la gauche */}
        <div className="p-3.5 rounded-lg border border-border/60 bg-card/40 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <div className="p-1 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <ArrowLeft className="size-3.5" />
            </div>
            <span>Balayage vers la gauche (Swipe Left)</span>
          </div>

          <div className="space-y-1.5">
            {SWIPE_ACTIONS_LEFT.map((opt) => {
              const isSelected = swipeLeftAction === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleLeftChange(opt.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors text-left ${
                    isSelected
                      ? "bg-primary/10 text-primary font-medium border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <span>{opt.label}</span>
                  {isSelected && <span className="text-[10px] font-bold">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
