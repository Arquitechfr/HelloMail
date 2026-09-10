"use client";

import { useState } from "react";
import { useAccounts } from "@/lib/queries/accounts";
import { useCreateRule, useUpdateRule } from "@/lib/queries/rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type {
  MailRule,
  RuleCondition,
  RuleAction,
  RuleConditionMatch,
  RuleConditionField,
  RuleConditionOperator,
  RuleActionType,
} from "@/lib/api-types";

interface RuleFormProps {
  ruleToEdit?: MailRule | null;
  onClose: () => void;
}

export function RuleForm({ ruleToEdit, onClose }: RuleFormProps) {
  const { data: accounts } = useAccounts();
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();

  const [name, setName] = useState(() => ruleToEdit?.name ?? "");
  const [accountId, setAccountId] = useState(() => ruleToEdit?.accountId ?? "");
  const [conditionMatch, setConditionMatch] = useState<RuleConditionMatch>(
    () => ruleToEdit?.conditionMatch ?? "all",
  );
  const [stopProcessing, setStopProcessing] = useState(
    () => ruleToEdit?.stopProcessing ?? false,
  );
  const [conditions, setConditions] = useState<RuleCondition[]>(() =>
    ruleToEdit?.conditions?.length
      ? ruleToEdit.conditions
      : [{ field: "from", operator: "contains", value: "" }],
  );
  const [actions, setActions] = useState<RuleAction[]>(() =>
    ruleToEdit?.actions?.length ? ruleToEdit.actions : [{ type: "markAsRead" }],
  );

  const addCondition = () => {
    setConditions([...conditions, { field: "subject", operator: "contains", value: "" }]);
  };
  const removeCondition = (index: number) => {
    if (conditions.length > 1) setConditions(conditions.filter((_, i) => i !== index));
  };
  const updateCondition = (index: number, patch: Partial<RuleCondition>) => {
    setConditions(conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const addAction = () => {
    setActions([...actions, { type: "markAsFlagged" }]);
  };
  const removeAction = (index: number) => {
    if (actions.length > 1) setActions(actions.filter((_, i) => i !== index));
  };
  const updateAction = (index: number, patch: Partial<RuleAction>) => {
    setActions(actions.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Veuillez donner un nom à la règle");
      return;
    }

    const payload = {
      name: name.trim(),
      accountId: accountId || undefined,
      conditionMatch,
      stopProcessing,
      conditions,
      actions,
    };

    try {
      if (ruleToEdit) {
        await updateRule.mutateAsync({ id: ruleToEdit._id, ...payload });
        toast.success("Règle mise à jour avec succès !");
      } else {
        await createRule.mutateAsync(payload);
        toast.success("Règle créée avec succès !");
      }
      onClose();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Erreur lors de l'enregistrement";
      toast.error(errorMsg);
    }
  };

  const isSaving = createRule.isPending || updateRule.isPending;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <DialogHeader className="pb-3 border-b border-border/60">
        <DialogTitle className="text-base sm:text-lg font-bold font-display flex items-center gap-2.5">
          <div className="flex size-8 sm:size-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
            <Sparkles className="size-4 sm:size-5" />
          </div>
          <div>
            <span>{ruleToEdit ? "Modifier la règle de tri" : "Nouvelle règle de tri automatique"}</span>
            <p className="text-xs font-normal text-muted-foreground mt-0.5">
              Filtrez et organisez automatiquement vos emails entrants.
            </p>
          </div>
        </DialogTitle>
      </DialogHeader>

      {/* Paramètres de base */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Nom de la règle</label>
          <Input
            placeholder="Ex: Factures & Reçus, Alertes Sécurité..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="h-9 text-xs sm:text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Compte concerné</label>
          <select
            className="h-9 rounded-md border border-border bg-background px-3 text-xs sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">Tous les comptes</option>
            {accounts?.map((acc) => (
              <option key={acc._id} value={acc._id}>
                {acc.emailAddress}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Section Conditions */}
      <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-muted/20 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">Si</span>
            <select
              className="h-8 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={conditionMatch}
              onChange={(e) => setConditionMatch(e.target.value as RuleConditionMatch)}
            >
              <option value="all">Toutes les conditions sont remplies (ET)</option>
              <option value="any">Au moins une condition est remplie (OU)</option>
            </select>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={addCondition}
          >
            <Plus className="size-3.5" /> Ajouter une condition
          </Button>
        </div>

        <div className="flex flex-col gap-2.5">
          {conditions.map((cond, idx) => (
            <div
              key={idx}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-md bg-background/80 border border-border/60 shadow-2xs"
            >
              <span className="hidden sm:flex size-6 items-center justify-center rounded-full bg-muted text-[11px] font-mono font-medium text-muted-foreground shrink-0">
                {idx + 1}
              </span>

              <select
                className="h-9 sm:w-44 md:w-52 rounded-md border border-border bg-background px-2.5 text-xs sm:text-sm text-foreground shrink-0 focus:outline-none focus:ring-1 focus:ring-primary"
                value={cond.field}
                onChange={(e) => updateCondition(idx, { field: e.target.value as RuleConditionField })}
              >
                <option value="from">Expéditeur (De)</option>
                <option value="to">Destinataire (À)</option>
                <option value="subject">Sujet du message</option>
                <option value="hasAttachments">Pièces jointes</option>
              </select>

              <select
                className="h-9 sm:w-40 md:w-48 rounded-md border border-border bg-background px-2.5 text-xs sm:text-sm text-foreground shrink-0 focus:outline-none focus:ring-1 focus:ring-primary"
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
                  className="h-9 flex-1 rounded-md border border-border bg-background px-2.5 text-xs sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  value={cond.value}
                  onChange={(e) => updateCondition(idx, { value: e.target.value })}
                >
                  <option value="true">Oui (avec pièces jointes)</option>
                  <option value="false">Non (sans pièce jointe)</option>
                </select>
              ) : (
                <Input
                  placeholder="Texte ou adresse recherchée..."
                  value={cond.value}
                  onChange={(e) => updateCondition(idx, { value: e.target.value })}
                  className="h-9 text-xs sm:text-sm flex-1 min-w-[140px]"
                />
              )}

              {conditions.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive shrink-0 self-end sm:self-center"
                  onClick={() => removeCondition(idx)}
                  title="Supprimer cette condition"
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Section Actions */}
      <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-muted/20 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">Alors exécuter les actions :</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={addAction}
          >
            <Plus className="size-3.5" /> Ajouter une action
          </Button>
        </div>

        <div className="flex flex-col gap-2.5">
          {actions.map((act, idx) => (
            <div
              key={idx}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-md bg-background/80 border border-border/60 shadow-2xs"
            >
              <span className="hidden sm:flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-mono font-medium shrink-0">
                →
              </span>

              <select
                className="h-9 sm:w-60 md:w-72 rounded-md border border-border bg-background px-2.5 text-xs sm:text-sm text-foreground shrink-0 focus:outline-none focus:ring-1 focus:ring-primary"
                value={act.type}
                onChange={(e) => updateAction(idx, { type: e.target.value as RuleActionType })}
              >
                <option value="markAsRead">Marquer comme lu</option>
                <option value="markAsFlagged">Marquer d&apos;une étoile (favori)</option>
                <option value="applyTag">Appliquer une étiquette</option>
                <option value="moveToFolder">Déplacer vers un dossier</option>
                <option value="markAsJunk">Marquer comme spam</option>
                <option value="delete">Supprimer définitivement</option>
              </select>

              {act.type === "applyTag" && (
                <Input
                  placeholder="Nom de l'étiquette (ex: Urgent, Projet...)"
                  value={act.tagName || ""}
                  onChange={(e) => updateAction(idx, { tagName: e.target.value })}
                  required
                  className="h-9 text-xs sm:text-sm flex-1 min-w-[160px]"
                />
              )}

              {act.type === "moveToFolder" && (
                <Input
                  placeholder="Nom du dossier (ex: Archive, Factures...)"
                  value={act.folderName || ""}
                  onChange={(e) => updateAction(idx, { folderName: e.target.value })}
                  required
                  className="h-9 text-xs sm:text-sm flex-1 min-w-[160px]"
                />
              )}

              {actions.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive shrink-0 ml-auto self-end sm:self-center"
                  onClick={() => removeAction(idx)}
                  title="Supprimer cette action"
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Option stopProcessing */}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="checkbox"
          id="stopProcessing"
          checked={stopProcessing}
          onChange={(e) => setStopProcessing(e.target.checked)}
          className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
        />
        <label htmlFor="stopProcessing" className="text-xs text-muted-foreground cursor-pointer select-none">
          Arrêter d&apos;évaluer les autres règles si celle-ci s&apos;applique
        </label>
      </div>

      <DialogFooter className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-border/50">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs h-9 px-4"
          onClick={onClose}
        >
          Annuler
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isSaving}
          className="text-xs h-9 px-5 bg-primary text-primary-foreground font-medium gap-1.5 shadow-sm"
        >
          {isSaving && <Loader2 className="size-3.5 animate-spin" />}
          {ruleToEdit ? "Enregistrer les modifications" : "Créer la règle de tri"}
        </Button>
      </DialogFooter>
    </form>
  );
}
