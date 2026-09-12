"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { usePreviewProfile, useRestoreProfile } from "@/lib/queries/profile";
import type {
  IProfilePreviewResult,
  ProfileSectionKey,
  IRestoreReport,
} from "@/lib/types/profile";
import { toast } from "sonner";
import {
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Tag,
  Filter,
  Sparkles,
  Users,
  PenLine,
  Sliders,
  FolderTree,
  Shield,
} from "lucide-react";

interface RestoreProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backupData: unknown;
  onSuccess?: (report: IRestoreReport) => void;
}

const SECTION_CONFIGS: Array<{
  key: ProfileSectionKey;
  label: string;
  icon: typeof Tag;
  getCount: (s: IProfilePreviewResult["summary"]) => string;
  hasData: (s: IProfilePreviewResult["summary"]) => boolean;
}> = [
  {
    key: "tags",
    label: "Libellés & Étiquettes",
    icon: Tag,
    getCount: (s) => `${s.tags.total} (${s.tags.new} nouveaux)`,
    hasData: (s) => s.tags.total > 0,
  },
  {
    key: "rules",
    label: "Règles & Filtres",
    icon: Filter,
    getCount: (s) => `${s.rules.total} (${s.rules.new} nouvelles)`,
    hasData: (s) => s.rules.total > 0,
  },
  {
    key: "templates",
    label: "Modèles d'emails",
    icon: Sparkles,
    getCount: (s) => `${s.templates.total} (${s.templates.new} nouveaux)`,
    hasData: (s) => s.templates.total > 0,
  },
  {
    key: "smartFolders",
    label: "Dossiers intelligents",
    icon: FolderTree,
    getCount: (s) => `${s.smartFolders.total} (${s.smartFolders.new} nouveaux)`,
    hasData: (s) => s.smartFolders.total > 0,
  },
  {
    key: "contacts",
    label: "Contacts",
    icon: Users,
    getCount: (s) => `${s.contacts.total} (${s.contacts.new} nouveaux)`,
    hasData: (s) => s.contacts.total > 0,
  },
  {
    key: "signatures",
    label: "Signatures",
    icon: PenLine,
    getCount: (s) => `${s.signatures.total} (${s.signatures.matchingAccounts} associables)`,
    hasData: (s) => s.signatures.total > 0,
  },
  {
    key: "senderLists",
    label: "Listes de sécurité",
    icon: Shield,
    getCount: (s) => `${s.senderLists.total} expéditeurs`,
    hasData: (s) => s.senderLists.total > 0,
  },
  {
    key: "preferences",
    label: "Préférences d'affichage & ergonomie",
    icon: Sliders,
    getCount: () => "Présentes",
    hasData: (s) => s.hasPreferences,
  },
];

export function RestoreProfileDialog({
  open,
  onOpenChange,
  backupData,
  onSuccess,
}: RestoreProfileDialogProps) {
  const [password, setPassword] = useState("");
  const [preview, setPreview] = useState<IProfilePreviewResult | null>(null);
  const [selectedSections, setSelectedSections] = useState<ProfileSectionKey[]>([]);
  const [conflictStrategy, setConflictStrategy] = useState<"skip" | "overwrite">("skip");

  const previewMutation = usePreviewProfile();
  const restoreMutation = useRestoreProfile();

  const isEncrypted = Boolean(
    backupData &&
      typeof backupData === "object" &&
      "format" in backupData &&
      (backupData as { format?: string }).format === "mailora-encrypted-profile",
  );

  useEffect(() => {
    if (open && backupData) {
      if (!isEncrypted) {
        previewMutation.mutate(
          { backupData },
          {
            onSuccess: (res) => {
              setPreview(res.preview);
              const available = SECTION_CONFIGS.filter((c) => c.hasData(res.preview.summary)).map(
                (c) => c.key,
              );
              setSelectedSections(available);
            },
            onError: (err) => {
              toast.error(`Fichier invalide : ${err.message}`);
              onOpenChange(false);
            },
          },
        );
      } else {
        setPreview(null);
        setPassword("");
      }
    }
  }, [open, backupData, isEncrypted]);

  const handleUnlockAndPreview = () => {
    if (!password) {
      toast.error("Veuillez saisir le mot de passe de déchiffrement");
      return;
    }

    previewMutation.mutate(
      { backupData, password },
      {
        onSuccess: (res) => {
          setPreview(res.preview);
          const available = SECTION_CONFIGS.filter((c) => c.hasData(res.preview.summary)).map(
            (c) => c.key,
          );
          setSelectedSections(available);
          toast.success("Sauvegarde déchiffrée avec succès");
        },
        onError: (err) => {
          toast.error(err.message || "Mot de passe incorrect");
        },
      },
    );
  };

  const toggleSection = (key: ProfileSectionKey) => {
    setSelectedSections((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleConfirmRestore = () => {
    if (selectedSections.length === 0) {
      toast.error("Veuillez cocher au moins une section à restaurer");
      return;
    }

    restoreMutation.mutate(
      {
        backupData,
        password: isEncrypted ? password : undefined,
        sections: selectedSections,
        conflictStrategy,
      },
      {
        onSuccess: (res) => {
          toast.success("Restauration du profil appliquée avec succès");
          onSuccess?.(res.report);
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(`Échec de restauration : ${err.message}`);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="size-4 text-primary" />
            <span>Restaurer une sauvegarde de profil</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Sélectionnez les éléments de configuration à réinjecter dans votre environnement Mailora.
          </DialogDescription>
        </DialogHeader>

        {isEncrypted && !preview ? (
          <div className="space-y-4 py-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500">
              <KeyRound className="size-4 shrink-0" />
              <span>Cette sauvegarde est chiffrée par mot de passe. Veuillez le saisir pour inspecter et restaurer son contenu.</span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="restore-pwd" className="text-xs font-medium">Mot de passe de déchiffrement</Label>
              <Input
                id="restore-pwd"
                type="password"
                placeholder="Votre mot de passe..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUnlockAndPreview()}
                className="text-xs"
              />
            </div>
            <Button
              size="sm"
              onClick={handleUnlockAndPreview}
              disabled={previewMutation.isPending}
              className="w-full text-xs"
            >
              {previewMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Déchiffrement en cours...
                </>
              ) : (
                "Déchiffrer et inspecter"
              )}
            </Button>
          </div>
        ) : previewMutation.isPending ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span>Analyse de la sauvegarde en cours...</span>
          </div>
        ) : preview ? (
          <div className="space-y-4 py-2">
            <div className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-md border border-border/50 flex justify-between items-center">
              <span>Exporté le {new Date(preview.metadata.exportedAt).toLocaleDateString()}</span>
              <span className="font-mono">{preview.metadata.userEmail}</span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {SECTION_CONFIGS.filter((c) => c.hasData(preview.summary)).map((conf) => {
                const Icon = conf.icon;
                const isSelected = selectedSections.includes(conf.key);
                return (
                  <div
                    key={conf.key}
                    onClick={() => toggleSection(conf.key)}
                    className="flex items-center justify-between p-2 rounded-md border border-border/60 hover:bg-muted/40 cursor-pointer transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSection(conf.key)}
                      />
                      <Icon className="size-3.5 text-muted-foreground" />
                      <span className="font-medium text-foreground">{conf.label}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {conf.getCount(preview.summary)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 pt-2 border-t border-border/60">
              <Label className="text-xs font-medium">Gestion des conflits d&apos;éléments existants</Label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setConflictStrategy("skip")}
                  className={`p-2 rounded-md border text-left transition-colors ${
                    conflictStrategy === "skip"
                      ? "border-primary bg-primary/10 text-foreground font-medium"
                      : "border-border/60 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <div>Ignorer les doublons</div>
                  <div className="text-[10px] text-muted-foreground">Préserve vos éléments actuels</div>
                </button>
                <button
                  type="button"
                  onClick={() => setConflictStrategy("overwrite")}
                  className={`p-2 rounded-md border text-left transition-colors ${
                    conflictStrategy === "overwrite"
                      ? "border-primary bg-primary/10 text-foreground font-medium"
                      : "border-border/60 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <div>Écraser / Mettre à jour</div>
                  <div className="text-[10px] text-muted-foreground">Remplace par la sauvegarde</div>
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Annuler
          </Button>
          {preview && (
            <Button
              size="sm"
              onClick={handleConfirmRestore}
              disabled={restoreMutation.isPending || selectedSections.length === 0}
              className="text-xs"
            >
              {restoreMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Restauration en cours...
                </>
              ) : (
                `Restaurer (${selectedSections.length} module${selectedSections.length > 1 ? "s" : ""})`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
