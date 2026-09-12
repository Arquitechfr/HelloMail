"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuthStore } from "@/lib/stores/authStore";
import { useMe, useUpdatePreferences } from "@/lib/queries/auth";
import {
  resolveUnifiedFolders,
  UNIFIED_FOLDER_DEFINITIONS,
  DEFAULT_UNIFIED_FOLDERS,
} from "@/lib/unified-utils";
import type { UnifiedFolderConfig } from "@/lib/api-types";
import { ChevronUp, ChevronDown, RotateCcw, Sliders, Check, Layers } from "lucide-react";
import { toast } from "sonner";

interface ManageUnifiedFoldersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageUnifiedFoldersDialog({
  open,
  onOpenChange,
}: ManageUnifiedFoldersDialogProps) {
  const storeUser = useAuthStore((s) => s.user);
  const { data: meData } = useMe();
  const user = meData?.user ?? storeUser;
  const updatePreferences = useUpdatePreferences();

  const [enabledGlobal, setEnabledGlobal] = useState(true);
  const [folders, setFolders] = useState<UnifiedFolderConfig[]>(DEFAULT_UNIFIED_FOLDERS);

  // Initialise l'état local depuis les préférences actuelles à l'ouverture
  useEffect(() => {
    if (open) {
      setEnabledGlobal(user?.preferences?.unifiedFoldersEnabled ?? true);
      setFolders(resolveUnifiedFolders(user?.preferences?.unifiedFolders));
    }
  }, [open, user?.preferences]);

  const handleToggleGlobal = (checked: boolean) => {
    setEnabledGlobal(checked);
  };

  const handleToggleFolder = (id: string, checked: boolean) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, enabled: checked } : f)),
    );
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= folders.length) return;

    setFolders((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy.map((item, idx) => ({ ...item, order: idx }));
    });
  };

  const handleResetDefaults = () => {
    setEnabledGlobal(true);
    setFolders(DEFAULT_UNIFIED_FOLDERS);
    toast.info("Configuration réinitialisée aux valeurs recommandées");
  };

  const handleSave = () => {
    updatePreferences.mutate(
      {
        unifiedFoldersEnabled: enabledGlobal,
        unifiedFolders: folders,
      },
      {
        onSuccess: () => {
          toast.success("Préférences des dossiers unifiés enregistrées");
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Erreur lors de l'enregistrement des préférences");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-lg md:max-w-2xl lg:max-w-3xl max-h-[88vh] overflow-y-auto no-scrollbar flex flex-col p-5 sm:p-6 gap-4">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Sliders className="size-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Gestion des dossiers unifiés
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Regroupez les emails de tous vos comptes en une vue consolidée.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Agencement en deux sections sur md+ et une section sur mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start pt-1">
          {/* Section 1 : Activation globale et informations */}
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between p-3.5 rounded-lg bg-muted/30 border border-border/70 shadow-2xs gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-foreground">
                  Activer les dossiers unifiés
                </span>
                <span className="text-[11px] text-muted-foreground leading-relaxed">
                  Affiche la section consolidée en haut de la barre latérale pour consulter tous vos comptes en un seul endroit.
                </span>
              </div>
              <Checkbox
                checked={enabledGlobal}
                onCheckedChange={(checked) => handleToggleGlobal(Boolean(checked))}
                aria-label="Activer les dossiers unifiés"
                className="mt-0.5"
              />
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/10 p-3 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Layers className="size-3.5 text-primary" />
                <span>Vue multi-comptes intelligente</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Chaque message affiche la pastille de couleur du compte d&apos;origine pour une distinction immédiate.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetDefaults}
                className="mt-1 text-xs h-7.5 gap-1.5 self-start text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3" />
                Rétablir les dossiers par défaut
              </Button>
            </div>
          </div>

          {/* Section 2 : Liste des dossiers unifiés et réorganisation */}
          <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/15 p-3 sm:p-3.5">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground pb-1">
              <span>Dossiers disponibles & ordre</span>
              <span className="text-[10px] font-normal text-muted-foreground">
                {folders.filter((f) => f.enabled).length} actif(s)
              </span>
            </div>

            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto no-scrollbar">
              {folders.map((folder, index) => {
                const meta = UNIFIED_FOLDER_DEFINITIONS[folder.id];
                const Icon = meta?.icon;

                return (
                  <div
                    key={folder.id}
                    className="flex items-center justify-between p-2 rounded-md border border-border/50 bg-background/80 hover:bg-muted/40 transition-colors gap-2 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Checkbox
                        checked={folder.enabled}
                        disabled={!enabledGlobal}
                        onCheckedChange={(checked) =>
                          handleToggleFolder(folder.id, Boolean(checked))
                        }
                        aria-label={`Activer ${folder.label}`}
                      />
                      {Icon && <Icon className="size-4 text-muted-foreground shrink-0" />}
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium truncate text-foreground">
                          {folder.label || meta?.defaultLabel}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {meta?.description}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={!enabledGlobal || index === 0}
                        onClick={() => handleMove(index, "up")}
                        title="Monter"
                        aria-label="Monter"
                        className="cursor-pointer"
                      >
                        <ChevronUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={!enabledGlobal || index === folders.length - 1}
                        onClick={() => handleMove(index, "down")}
                        title="Descendre"
                        aria-label="Descendre"
                        className="cursor-pointer"
                      >
                        <ChevronDown className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2 pt-3 border-t border-border flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Annuler
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={updatePreferences.isPending}
            className="text-xs gap-1.5"
          >
            <Check className="size-3.5" />
            <span>Enregistrer</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
