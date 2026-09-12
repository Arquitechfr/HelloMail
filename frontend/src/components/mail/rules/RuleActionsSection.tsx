"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import type { RuleAction, RuleActionType } from "@/lib/api-types";

interface RuleActionsSectionProps {
  actions: RuleAction[];
  addAction: () => void;
  removeAction: (index: number) => void;
  updateAction: (index: number, patch: Partial<RuleAction>) => void;
  stopProcessing: boolean;
  setStopProcessing: (stop: boolean) => void;
}

export function RuleActionsSection({
  actions,
  addAction,
  removeAction,
  updateAction,
  stopProcessing,
  setStopProcessing,
}: RuleActionsSectionProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-muted/20 p-3.5 sm:p-4 flex-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">Alors exécuter les actions :</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7.5 text-xs gap-1.5"
          onClick={addAction}
        >
          <Plus className="size-3.5" /> Ajouter
        </Button>
      </div>

      <div className="flex flex-col gap-2 max-h-[48vh] overflow-y-auto no-scrollbar">
        {actions.map((act, idx) => (
          <div
            key={idx}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 rounded-md bg-background/90 border border-border/60 shadow-2xs"
          >
            <span className="hidden sm:flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-mono font-medium shrink-0">
              →
            </span>

            <select
              className="h-8 sm:w-48 rounded-md border border-border bg-background px-2 text-xs text-foreground shrink-0 focus:outline-none focus:ring-1 focus:ring-primary"
              value={act.type}
              onChange={(e) => updateAction(idx, { type: e.target.value as RuleActionType })}
            >
              <option value="markAsRead">Marquer comme lu</option>
              <option value="markAsFlagged">Marquer d'une étoile</option>
              <option value="pinMessage">Mettre en avant (épingler)</option>
              <option value="applyTag">Appliquer une étiquette</option>
              <option value="moveToFolder">Déplacer vers un dossier</option>
              <option value="markAsJunk">Marquer comme spam</option>
              <option value="delete">Supprimer définitivement</option>
            </select>

            {act.type === "applyTag" && (
              <Input
                placeholder="Nom de l'étiquette..."
                value={act.tagName || ""}
                onChange={(e) => updateAction(idx, { tagName: e.target.value })}
                required
                className="h-8 text-xs flex-1 min-w-[120px]"
              />
            )}

            {act.type === "moveToFolder" && (
              <Input
                placeholder="Nom du dossier..."
                value={act.folderName || ""}
                onChange={(e) => updateAction(idx, { folderName: e.target.value })}
                required
                className="h-8 text-xs flex-1 min-w-[120px]"
              />
            )}

            {actions.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0 ml-auto self-end sm:self-center"
                onClick={() => removeAction(idx)}
                title="Supprimer cette action"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Option stopProcessing */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/40 mt-auto">
        <input
          type="checkbox"
          id="stopProcessing"
          checked={stopProcessing}
          onChange={(e) => setStopProcessing(e.target.checked)}
          className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
        />
        <label htmlFor="stopProcessing" className="text-[11px] text-muted-foreground cursor-pointer select-none">
          Arrêter d&apos;évaluer les autres règles après celle-ci
        </label>
      </div>
    </div>
  );
}
