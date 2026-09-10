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
  const [accountId, setAccountId] = useState<string>(() => ruleToEdit?.accountId ?? "");
  const [conditionMatch, setConditionMatch] = useState<RuleConditionMatch>(
    () => ruleToEdit?.conditionMatch ?? "all",
  );
  const [stopProcessing, setStopProcessing] = useState(
    () => ruleToEdit?.stopProcessing ?? false,
  );
  const [conditions, setConditions] = useState<RuleCondition[]>(() =>
    ruleToEdit?.conditions && ruleToEdit.conditions.length > 0
      ? ruleToEdit.conditions
      : [{ field: "from", operator: "contains", value: "" }],
  );
  const [actions, setActions] = useState<RuleAction[]>(() =>
    ruleToEdit?.actions && ruleToEdit.actions.length > 0
      ? ruleToEdit.actions
      : [{ type: "markAsRead" }],
  );

  const addCondition = () => {
    setConditions([...conditions, { field: "subject", operator: "contains", value: "" }]);
  };

  const removeCondition = (index: number) => {
    if (conditions.length <= 1) return;
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, patch: Partial<RuleCondition>) => {
    setConditions(conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const addAction = () => {
    setActions([...actions, { type: "markAsFlagged" }]);
  };

  const removeAction = (index: number) => {
    if (actions.length <= 1) return;
    setActions(actions.filter((_, i) => i !== index));
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
      <DialogHeader>
        <DialogTitle className="text-base font-bold font-display flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          {ruleToEdit ? "Modifier la règle de tri" : "Nouvelle règle de tri"}
        </DialogTitle>
      </DialogHeader>

      {/* Paramètres de base */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Nom de la règle</label>
          <Input
            placeholder="Ex: Trier les factures"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="h-8 text-xs"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Compte concerné</label>
          <select
            className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
      <div className="flex flex-col gap-2 rounded-md border border-border/80 bg-muted/20 p-3.5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">Si</span>
            <select
              className="h-7 rounded border border-border bg-background px-2 text-[11px] font-medium text-foreground"
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
            className="h-7 text-[11px] gap-1"
            onClick={addCondition}
          >
            <Plus className="size-3" /> Ajouter
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {conditions.map((cond, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                className="h-8 rounded border border-border bg-background px-2 text-xs text-foreground shrink-0 w-32"
                value={cond.field}
                onChange={(e) => updateCondition(idx, { field: e.target.value as RuleConditionField })}
              >
                <option value="from">Expéditeur (De)</option>
                <option value="to">Destinataire (À)</option>
                <option value="subject">Sujet</option>
                <option value="hasAttachments">Pièces jointes</option>
              </select>

              <select
                className="h-8 rounded border border-border bg-background px-2 text-xs text-foreground shrink-0 w-36"
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
                  className="h-8 rounded border border-border bg-background px-2 text-xs text-foreground flex-1"
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
                  className="h-8 text-xs flex-1"
                />
              )}

              {conditions.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => removeCondition(idx)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Section Actions */}
      <div className="flex flex-col gap-2 rounded-md border border-border/80 bg-muted/20 p-3.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-foreground">Alors exécuter les actions :</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1"
            onClick={addAction}
          >
            <Plus className="size-3" /> Ajouter
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {actions.map((act, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                className="h-8 rounded border border-border bg-background px-2 text-xs text-foreground shrink-0 w-52"
                value={act.type}
                onChange={(e) => updateAction(idx, { type: e.target.value as RuleActionType })}
              >
                <option value="markAsRead">Marquer comme lu</option>
                <option value="markAsFlagged">Marquer d&apos;une étoile (favori)</option>
                <option value="moveToFolder">Déplacer vers un dossier</option>
                <option value="markAsJunk">Marquer comme spam</option>
                <option value="delete">Supprimer définitivement</option>
              </select>

              {act.type === "moveToFolder" && (
                <Input
                  placeholder="Nom du dossier (ex: Archive, Factures...)"
                  value={act.folderName || ""}
                  onChange={(e) => updateAction(idx, { folderName: e.target.value })}
                  required
                  className="h-8 text-xs flex-1"
                />
              )}

              {actions.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0 ml-auto"
                  onClick={() => removeAction(idx)}
                >
                  <Trash2 className="size-3.5" />
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
          className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
        />
        <label htmlFor="stopProcessing" className="text-xs text-muted-foreground cursor-pointer select-none">
          Arrêter d&apos;évaluer les autres règles si celle-ci s&apos;applique
        </label>
      </div>

      <DialogFooter className="gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs h-8"
          onClick={onClose}
        >
          Annuler
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isSaving}
          className="text-xs h-8 bg-primary text-primary-foreground gap-1.5"
        >
          {isSaving && <Loader2 className="size-3.5 animate-spin" />}
          {ruleToEdit ? "Enregistrer" : "Créer la règle"}
        </Button>
      </DialogFooter>
    </form>
  );
}
