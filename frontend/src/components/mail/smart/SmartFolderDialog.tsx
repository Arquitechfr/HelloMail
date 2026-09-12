"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateSmartFolder, useUpdateSmartFolder } from "@/lib/queries/smartFolders";
import { useAccounts } from "@/lib/queries/accounts";
import type { SmartFolder } from "@/lib/api-types";
import { Sparkles, Loader2, Filter } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  SMART_FOLDER_ICONS,
  COLOR_PALETTE,
  QUERY_HELPERS,
} from "@/lib/smart-folder-constants";

export { SMART_FOLDER_ICONS };

interface SmartFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderToEdit?: SmartFolder | null;
  initialQuery?: string;
}

export function SmartFolderDialog({
  open,
  onOpenChange,
  folderToEdit,
  initialQuery,
}: SmartFolderDialogProps) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [icon, setIcon] = useState("Sparkles");
  const [color, setColor] = useState("#3b82f6");
  const [accountId, setAccountId] = useState<string>("all");

  const { data: accounts = [] } = useAccounts();
  const createMutation = useCreateSmartFolder();
  const updateMutation = useUpdateSmartFolder();

  const isEditing = Boolean(folderToEdit);
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (folderToEdit) {
      setName(folderToEdit.name);
      setQuery(folderToEdit.query);
      setIcon(folderToEdit.icon || "Sparkles");
      setColor(folderToEdit.color || "#3b82f6");
      setAccountId(folderToEdit.accountId || "all");
    } else {
      setName("");
      setQuery(initialQuery || "");
      setIcon("Sparkles");
      setColor("#3b82f6");
      setAccountId("all");
    }
  }, [folderToEdit, initialQuery, open]);

  const addQuerySnippet = (snippet: string) => {
    setQuery((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return snippet;
      if (trimmed.includes(snippet)) return trimmed;
      return `${trimmed} ${snippet}`;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Veuillez saisir un nom pour le dossier intelligent");
      return;
    }
    if (!query.trim()) {
      toast.error("Veuillez saisir une requête de recherche");
      return;
    }

    try {
      if (isEditing && folderToEdit) {
        await updateMutation.mutateAsync({
          id: folderToEdit._id,
          name: name.trim(),
          query: query.trim(),
          icon,
          color,
          accountId: accountId === "all" ? null : accountId,
        });
        toast.success("Dossier intelligent mis à jour");
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          query: query.trim(),
          icon,
          color,
          accountId: accountId === "all" ? undefined : accountId,
        });
        toast.success("Dossier intelligent créé");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de l'enregistrement du dossier intelligent",
      );
    }
  };

  const SelectedIcon = SMART_FOLDER_ICONS[icon] || Sparkles;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] sm:!max-w-3xl lg:!max-w-4xl xl:!max-w-5xl border border-border bg-card p-6 sm:p-8 shadow-2xl rounded-2xl no-scrollbar max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b border-border/60">
          <div className="flex items-center gap-3.5">
            <div
              className="flex size-12 items-center justify-center rounded-xl border-2 shadow-xs shrink-0 transition-all"
              style={{ backgroundColor: `${color}20`, borderColor: `${color}60`, color }}
            >
              <SelectedIcon className="size-6 shrink-0" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-semibold font-display text-foreground">
                {isEditing ? "Modifier le dossier intelligent" : "Créer un dossier intelligent"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Regroupez automatiquement vos messages selon des règles de recherche dynamiques
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
            {/* Colonne 1 : Identité visuelle & Portée */}
            <div className="space-y-5">
              <div>
                <Label htmlFor="smart-name" className="text-xs font-semibold text-foreground mb-1.5 block">
                  Nom du dossier
                </Label>
                <Input
                  id="smart-name"
                  placeholder="Ex : Factures urgentes, Clients VIP..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 text-xs bg-muted/20"
                  autoFocus
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-foreground mb-1.5 block">
                  Icône
                </Label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 p-3 rounded-xl border border-border bg-muted/20">
                  {Object.entries(SMART_FOLDER_ICONS).map(([iconKey, IconComponent]) => {
                    const isSelected = icon === iconKey;
                    return (
                      <button
                        key={iconKey}
                        type="button"
                        onClick={() => setIcon(iconKey)}
                        className={cn(
                          "flex h-11 w-full items-center justify-center rounded-xl border transition-all cursor-pointer shadow-2xs",
                          isSelected
                            ? "border-2 shadow-xs ring-2 ring-offset-1 font-semibold"
                            : "border-border/70 bg-card text-foreground/80 hover:border-primary/50 hover:bg-muted/80 hover:text-foreground",
                        )}
                        style={
                          isSelected
                            ? {
                                borderColor: color,
                                backgroundColor: `${color}20`,
                                color,
                              }
                            : undefined
                        }
                        title={iconKey}
                      >
                        <IconComponent className="size-5 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-foreground mb-1.5 block">
                  Couleur
                </Label>
                <div className="flex items-center gap-3 flex-wrap">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        "size-8 rounded-full transition-all cursor-pointer flex items-center justify-center border border-black/15 shadow-xs",
                        color === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-105 opacity-85 hover:opacity-100",
                      )}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="smart-account" className="text-xs font-semibold text-foreground mb-1.5 block">
                  Périmètre des comptes
                </Label>
                <select
                  id="smart-account"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                >
                  <option value="all">Tous les comptes (Unifié)</option>
                  {accounts.map((acc) => (
                    <option key={acc._id} value={acc._id}>
                      {acc.displayName ? `${acc.displayName} (${acc.emailAddress})` : acc.emailAddress}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Colonne 2 : Requête & Filtres rapides */}
            <div className="space-y-5">
              <div>
                <Label htmlFor="smart-query" className="text-xs font-semibold text-foreground mb-1.5 flex items-center justify-between">
                  <span>Critères de recherche</span>
                  <Filter className="size-3.5 text-muted-foreground" />
                </Label>
                <Input
                  id="smart-query"
                  placeholder="Ex : is:unread from:stripe.com"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-9 text-xs font-mono bg-muted/20"
                />
              </div>

              <div>
                <span className="text-[11px] font-medium text-muted-foreground mb-1.5 block">
                  Filtres rapides (cliquez pour ajouter)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUERY_HELPERS.map((helper) => (
                    <button
                      key={helper.label}
                      type="button"
                      onClick={() => addQuerySnippet(helper.snippet)}
                      className="px-2.5 py-1 rounded-md border border-border/80 bg-muted/40 hover:bg-muted text-[11px] text-muted-foreground hover:text-foreground font-mono transition-colors cursor-pointer"
                    >
                      {helper.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/30 text-xs text-muted-foreground space-y-1.5">
                <span className="font-semibold text-foreground block">Opérateurs supportés :</span>
                <p className="text-[11px] leading-relaxed">
                  <code className="font-mono text-primary font-medium">is:unread</code>,{" "}
                  <code className="font-mono text-primary font-medium">is:pinned</code>,{" "}
                  <code className="font-mono text-primary font-medium">is:flagged</code>,{" "}
                  <code className="font-mono text-primary font-medium">has:attachment</code>,{" "}
                  <code className="font-mono text-primary font-medium">larger:5M</code>,{" "}
                  <code className="font-mono text-primary font-medium">from:email</code>,{" "}
                  <code className="font-mono text-primary font-medium">subject:mot</code>
                </p>
                <p className="text-[10px] text-muted-foreground/80 italic pt-1 border-t border-border/40">
                  Les dossiers Corbeille et Spams sont automatiquement exclus de la recherche.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-border/60 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="min-w-28">
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Enregistrement...
                </>
              ) : isEditing ? (
                "Mettre à jour"
              ) : (
                "Créer le dossier"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
