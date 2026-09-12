"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import type {
  RuleCondition,
  RuleConditionMatch,
  RuleConditionField,
  RuleConditionOperator,
} from "@/lib/api-types";

interface RuleConditionsSectionProps {
  conditionMatch: RuleConditionMatch;
  setConditionMatch: (match: RuleConditionMatch) => void;
  conditions: RuleCondition[];
  addCondition: () => void;
  removeCondition: (index: number) => void;
  updateCondition: (index: number, patch: Partial<RuleCondition>) => void;
}

export function RuleConditionsSection({
  conditionMatch,
  setConditionMatch,
  conditions,
  addCondition,
  removeCondition,
  updateCondition,
}: RuleConditionsSectionProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-muted/20 p-3.5 sm:p-4 flex-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">Si</span>
          <select
            className="h-8 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            value={conditionMatch}
            onChange={(e) => setConditionMatch(e.target.value as RuleConditionMatch)}
          >
            <option value="all">Toutes les conditions (ET)</option>
            <option value="any">Au moins une condition (OU)</option>
          </select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7.5 text-xs gap-1.5 shrink-0"
          onClick={addCondition}
        >
          <Plus className="size-3.5" /> Ajouter
        </Button>
      </div>

      <div className="flex flex-col gap-2 max-h-[48vh] overflow-y-auto no-scrollbar">
        {conditions.map((cond, idx) => (
          <div
            key={idx}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 rounded-md bg-background/90 border border-border/60 shadow-2xs"
          >
            <span className="hidden sm:flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-mono font-medium text-muted-foreground shrink-0">
              {idx + 1}
            </span>

            <select
              className="h-8 sm:w-32 rounded-md border border-border bg-background px-2 text-xs text-foreground shrink-0 focus:outline-none focus:ring-1 focus:ring-primary"
              value={cond.field}
              onChange={(e) => updateCondition(idx, { field: e.target.value as RuleConditionField })}
            >
              <option value="from">Expéditeur (De)</option>
              <option value="to">Destinataire (À)</option>
              <option value="subject">Sujet</option>
              <option value="hasAttachments">Pièces jointes</option>
            </select>

            <select
              className="h-8 sm:w-28 rounded-md border border-border bg-background px-2 text-xs text-foreground shrink-0 focus:outline-none focus:ring-1 focus:ring-primary"
              value={cond.operator}
              onChange={(e) => updateCondition(idx, { operator: e.target.value as RuleConditionOperator })}
            >
              <option value="contains">contient</option>
              <option value="notContains">ne contient pas</option>
              <option value="equals">est exactement</option>
              <option value="startsWith">commence par</option>
              <option value="endsWith">se termine par</option>
            </select>

            {cond.field === "hasAttachments" ? (
              <select
                className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={cond.value}
                onChange={(e) => updateCondition(idx, { value: e.target.value })}
              >
                <option value="true">Oui</option>
                <option value="false">Non</option>
              </select>
            ) : (
              <Input
                placeholder="Valeur recherchée..."
                value={cond.value}
                onChange={(e) => updateCondition(idx, { value: e.target.value })}
                className="h-8 text-xs flex-1 min-w-[110px]"
              />
            )}

            {conditions.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0 self-end sm:self-center"
                onClick={() => removeCondition(idx)}
                title="Supprimer cette condition"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
