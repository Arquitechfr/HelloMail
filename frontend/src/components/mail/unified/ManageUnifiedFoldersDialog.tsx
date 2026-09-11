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
import { ChevronUp, ChevronDown, RotateCcw, Sliders, Check } from "lucide-react";
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
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-5">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sliders className="size-4" />
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

        {/* Activation globale */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/60 my-2">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-foreground">
              Activer les dossiers unifiés
            </span>
            <span className="text-[11px] text-muted-foreground">
              Affiche la section consolidée en haut de la barre latérale
            </span>
          </div>
          <Checkbox
            checked={enabledGlobal}
            onCheckedChange={(checked) => handleToggleGlobal(Boolean(checked))}
            aria-label="Activer les dossiers unifiés"
          />
        </div>

        {/* Liste des dossiers unifiés avec activation et ordonnancement */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 py-1">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Dossiers disponibles & ordre
            </span>
            <Button
              variant="ghost"
              size="xs"
              onClick={handleResetDefaults}
              className="text-[11px] h-6 px-2 text-muted-foreground hover:text-foreground gap-1"
            >
              <RotateCcw className="size-3" />
              Par défaut
            </Button>
          </div>

          {folders.map((folder, index) => {
            const meta = UNIFIED_FOLDER_DEFINITIONS[folder.id];
            const Icon = meta?.icon;

            return (
              <div
                key={folder.id}
                className="flex items-center justify-between p-2 rounded-md border border-border/40 hover:bg-muted/30 transition-colors gap-2"
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
                    variant="ghost"
                    size="icon-xs"
                    disabled={!enabledGlobal || index === 0}
                    onClick={() => handleMove(index, "up")}
                    title="Monter"
                    aria-label="Monter"
                  >
                    <ChevronUp className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={!enabledGlobal || index === folders.length - 1}
                    onClick={() => handleMove(index, "down")}
                    title="Descendre"
                    aria-label="Descendre"
                  >
                    <ChevronDown className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="mt-3 pt-3 border-t border-border flex items-center justify-between sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Annuler
          </Button>
          <Button
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
