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
import {
  Sparkles,
  Inbox,
  Star,
  Bookmark,
  FileText,
  Receipt,
  Tag,
  AlertCircle,
  Zap,
  Clock,
  Flame,
  Shield,
  Loader2,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const SMART_FOLDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  Inbox,
  Star,
  Bookmark,
  FileText,
  Receipt,
  Tag,
  AlertCircle,
  Zap,
  Clock,
  Flame,
  Shield,
};

const COLOR_PALETTE = [
  "#3b82f6", // Bleu
  "#6366f1", // Indigo
  "#8b5cf6", // Violet
  "#ec4899", // Rose
  "#ef4444", // Rouge
  "#f59e0b", // Ambre
  "#10b981", // Émeraude
  "#06b6d4", // Cyan
];

const QUERY_HELPERS = [
  { label: "+ Non lus", snippet: "is:unread" },
  { label: "+ Épinglés", snippet: "is:pinned" },
  { label: "+ Important", snippet: "is:flagged" },
  { label: "+ Avec PJ", snippet: "has:attachment" },
  { label: "+ De...", snippet: "from:@" },
  { label: "+ Sujet...", snippet: "subject:" },
];

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-border bg-card max-w-2xl p-6 shadow-2xl rounded-xl no-scrollbar">
        <DialogHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div
              className="flex size-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {(() => {
                const SelectedIcon = SMART_FOLDER_ICONS[icon] || Sparkles;
                return <SelectedIcon className="size-5" />;
              })()}
            </div>
            <div>
              <DialogTitle className="text-base font-semibold font-display">
                {isEditing ? "Modifier le dossier intelligent" : "Créer un dossier intelligent"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Regroupez automatiquement vos messages selon des règles de recherche dynamiques
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {/* Contenu adaptatif : 2 colonnes sur écran moyen+, 1 colonne sur mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Colonne 1 : Identité & Portée */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="smart-name" className="text-xs font-semibold text-foreground mb-1.5 block">
                  Nom du dossier
                </Label>
                <Input
                  id="smart-name"
                  placeholder="Ex : Factures urgentes, Clients VIP..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 text-xs"
                  autoFocus
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-foreground mb-1.5 block">
                  Icône
                </Label>
                <div className="grid grid-cols-6 gap-1.5 p-1.5 rounded-lg border border-border bg-muted/20">
                  {Object.entries(SMART_FOLDER_ICONS).map(([iconKey, IconComponent]) => (
                    <button
                      key={iconKey}
                      type="button"
                      onClick={() => setIcon(iconKey)}
                      className={cn(
                        "flex items-center justify-center p-2 rounded-md transition-all cursor-pointer",
                        icon === iconKey
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                      title={iconKey}
                    >
                      <IconComponent className="size-4" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-foreground mb-1.5 block">
                  Couleur
                </Label>
                <div className="flex items-center gap-2">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        "size-6 rounded-full transition-transform cursor-pointer flex items-center justify-center",
                        color === c ? "scale-115 ring-2 ring-foreground/20 ring-offset-1" : "hover:scale-105",
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
                      {acc.emailAddress}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Colonne 2 : Requête & Filtres rapides */}
            <div className="space-y-4">
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
                  className="h-9 text-xs font-mono"
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
                      className="px-2 py-1 rounded border border-border/80 bg-muted/40 hover:bg-muted text-[11px] text-muted-foreground hover:text-foreground font-mono transition-colors cursor-pointer"
                    >
                      {helper.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border/60 bg-muted/30 text-xs text-muted-foreground space-y-1">
                <span className="font-semibold text-foreground block">Opérateurs supportés :</span>
                <p className="text-[11px]">
                  <code className="font-mono text-primary">is:unread</code>,{" "}
                  <code className="font-mono text-primary">is:pinned</code>,{" "}
                  <code className="font-mono text-primary">is:flagged</code>,{" "}
                  <code className="font-mono text-primary">has:attachment</code>,{" "}
                  <code className="font-mono text-primary">tag:nom</code>,{" "}
                  <code className="font-mono text-primary">from:email</code>,{" "}
                  <code className="font-mono text-primary">subject:mot</code>
                </p>
                <p className="text-[10px] text-muted-foreground/80 italic">
                  Les dossiers Corbeille et Spams sont automatiquement exclus.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-border/60 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
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
