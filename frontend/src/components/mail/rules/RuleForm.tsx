"use client";

import { useState } from "react";
import { useAccounts } from "@/lib/queries/accounts";
import { useCreateRule, useUpdateRule } from "@/lib/queries/rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RuleConditionsSection } from "./RuleConditionsSection";
import { RuleActionsSection } from "./RuleActionsSection";
import type {
  MailRule,
  RuleCondition,
  RuleAction,
  RuleConditionMatch,
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
  const [conditionMatch, setConditionMatch] = useState<RuleConditionMatch>(() => ruleToEdit?.conditionMatch ?? "all");
  const [stopProcessing, setStopProcessing] = useState(() => ruleToEdit?.stopProcessing ?? false);
  const [conditions, setConditions] = useState<RuleCondition[]>(() =>
    ruleToEdit?.conditions?.length ? ruleToEdit.conditions : [{ field: "from", operator: "contains", value: "" }],
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader className="pb-2.5 border-b border-border/60">
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

      {/* Paramètres de base de la règle */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Nom de la règle</label>
          <Input
            placeholder="Ex: Factures & Reçus, Alertes Sécurité..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="h-8.5 text-xs sm:text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Compte concerné</label>
          <select
            className="h-8.5 rounded-md border border-border bg-background px-3 text-xs sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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

      {/* Disposition en deux sections sur écran large (Conditions à gauche, Actions à droite) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <RuleConditionsSection
          conditionMatch={conditionMatch}
          setConditionMatch={setConditionMatch}
          conditions={conditions}
          addCondition={addCondition}
          removeCondition={removeCondition}
          updateCondition={updateCondition}
        />
        <RuleActionsSection
          actions={actions}
          addAction={addAction}
          removeAction={removeAction}
          updateAction={updateAction}
          stopProcessing={stopProcessing}
          setStopProcessing={setStopProcessing}
        />
      </div>

      <DialogFooter className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2.5 border-t border-border/50">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs h-8.5 px-4"
          onClick={onClose}
        >
          Annuler
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isSaving}
          className="text-xs h-8.5 px-5 bg-primary text-primary-foreground font-medium gap-1.5 shadow-xs"
        >
          {isSaving && <Loader2 className="size-3.5 animate-spin" />}
          {ruleToEdit ? "Enregistrer les modifications" : "Créer la règle de tri"}
        </Button>
      </DialogFooter>
    </form>
  );
}
