"use client";

import { useState } from "react";
import { useRules, useUpdateRule, useDeleteRule, useReorderRules } from "@/lib/queries/rules";
import { useAccounts } from "@/lib/queries/accounts";
import type { MailRule, RuleCondition, RuleAction } from "@/lib/api-types";
import { RuleDialog } from "./RuleDialog";
import { Button } from "@/components/ui/button";
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Filter,
  CheckCircle2,
  Loader2,
  FolderOpen,
  Eye,
  Star,
  AlertTriangle,
  Tag,
} from "lucide-react";
import { toast } from "sonner";

export function RulesList() {
  const { data: rulesData, isLoading } = useRules();
  const { data: accounts } = useAccounts();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();
  const reorderRules = useReorderRules();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<MailRule | null>(null);

  const rules = rulesData?.data || [];

  const handleCreate = () => {
    setEditingRule(null);
    setDialogOpen(true);
  };

  const handleEdit = (rule: MailRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleDelete = async (rule: MailRule) => {
    if (!window.confirm(`Supprimer définitivement la règle "${rule.name}" ?`)) return;
    try {
      await deleteRule.mutateAsync(rule._id);
      toast.success("Règle supprimée avec succès");
    } catch {
      toast.error("Échec de la suppression de la règle");
    }
  };

  const handleToggleActive = async (rule: MailRule) => {
    try {
      await updateRule.mutateAsync({ id: rule._id, isActive: !rule.isActive });
      toast.success(rule.isActive ? "Règle désactivée" : "Règle activée");
    } catch {
      toast.error("Échec de la modification");
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rules.length) return;

    const newRules = [...rules];
    const [moved] = newRules.splice(index, 1);
    newRules.splice(targetIndex, 0, moved);

    try {
      await reorderRules.mutateAsync(newRules.map((r) => r._id));
      toast.success("Priorité mise à jour");
    } catch {
      toast.error("Échec de la mise à jour de l'ordre");
    }
  };

  const getAccountEmail = (accountId?: string) => {
    if (!accountId) return "Tous les comptes";
    return accounts?.find((a) => a._id === accountId)?.emailAddress || "Compte spécifique";
  };

  const renderConditionSummary = (cond: RuleCondition) => {
    const fieldMap: Record<string, string> = {
      from: "De",
      to: "À",
      subject: "Sujet",
      hasAttachments: "PJ",
    };
    const opMap: Record<string, string> = {
      contains: "contient",
      notContains: "ne contient pas",
      equals: "=",
      startsWith: "commence par",
      endsWith: "se termine par",
    };
    return `${fieldMap[cond.field] || cond.field} ${opMap[cond.operator] || cond.operator} "${cond.value || "oui"}"`;
  };

  const renderActionIcon = (action: RuleAction) => {
    switch (action.type) {
      case "moveToFolder":
        return <FolderOpen className="size-3 text-primary" />;
      case "markAsRead":
        return <Eye className="size-3 text-emerald-500" />;
      case "markAsFlagged":
        return <Star className="size-3 text-amber-500" />;
      case "markAsJunk":
        return <AlertTriangle className="size-3 text-destructive" />;
      case "delete":
        return <Trash2 className="size-3 text-destructive" />;
      case "applyTag":
        return <Tag className="size-3 text-primary" />;
      default:
        return null;
    }
  };

  const renderActionLabel = (action: RuleAction) => {
    switch (action.type) {
      case "moveToFolder":
        return `Déplacer vers ${action.folderName || "..."}`;
      case "markAsRead":
        return "Marquer lu";
      case "markAsFlagged":
        return "Étoiler";
      case "markAsJunk":
        return "Marquer spam";
      case "delete":
        return "Supprimer";
      case "applyTag":
        return `Étiquette: ${action.tagName || "..."}`;
      default:
        return action.type;
    }
  };

  return (
    <>
      <div className="rounded-md border border-border bg-card/60 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-primary" />
            <h2 className="text-sm font-bold font-display text-foreground">
              Règles de tri actif
            </h2>
          </div>
          <Button
            size="sm"
            className="gap-1.5 text-xs h-8 bg-primary text-primary-foreground"
            onClick={handleCreate}
          >
            <Plus className="size-3.5" />
            Nouvelle règle
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Les règles sont exécutées automatiquement dans l&apos;ordre de priorité lors de l&apos;arrivée de chaque nouvel email.
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center rounded-md bg-muted/20 border border-border/40">
            <Filter className="size-8 text-muted-foreground/50 mb-2" />
            <p className="text-xs font-medium text-foreground">Aucune règle configurée</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-sm">
              Automatisez l&apos;organisation de vos messages en créant votre première règle de tri.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {rules.map((rule, index) => (
              <div
                key={rule._id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-md border border-border/60 bg-muted/20 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <span className="flex size-6 items-center justify-center rounded bg-primary/10 text-primary font-mono text-[11px] font-bold shrink-0">
                    #{index + 1}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {rule.name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
                        {getAccountEmail(rule.accountId)}
                      </span>
                      {rule.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                          <CheckCircle2 className="size-3" /> Active
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">
                          Inactive
                        </span>
                      )}
                    </div>

                    {/* Résumé conditions & actions */}
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1 flex-wrap">
                      <span className="font-mono text-[10px] bg-background/80 px-1.5 py-0.5 rounded border border-border/50">
                        Si {rule.conditionMatch === "all" ? "TOUS" : "UN"} :{" "}
                        {rule.conditions.map((c) => renderConditionSummary(c)).join(", ")}
                      </span>
                      <span>→</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {rule.actions.map((a, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 bg-background/80 px-1.5 py-0.5 rounded border border-border/50 text-[10px]"
                          >
                            {renderActionIcon(a)}
                            <span>{renderActionLabel(a)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions sur la règle */}
                <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-7 p-0"
                    disabled={index === 0}
                    onClick={() => handleMove(index, "up")}
                    title="Monter la priorité"
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-7 p-0"
                    disabled={index === rules.length - 1}
                    onClick={() => handleMove(index, "down")}
                    title="Descendre la priorité"
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-7 p-0"
                    onClick={() => handleToggleActive(rule)}
                    title={rule.isActive ? "Désactiver" : "Activer"}
                  >
                    <CheckCircle2
                      className={`size-3.5 ${rule.isActive ? "text-emerald-500" : "text-muted-foreground"}`}
                    />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-7 p-0"
                    onClick={() => handleEdit(rule)}
                    title="Modifier"
                  >
                    <Edit2 className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-7 p-0 text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(rule)}
                    title="Supprimer"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        ruleToEdit={editingRule}
      />
    </>
  );
}
