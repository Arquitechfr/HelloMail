"use client";

import { useState } from "react";
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
import { useCreateSenderEntry } from "@/lib/queries/senderLists";
import type { SenderListType } from "@/lib/api-types";
import { ShieldCheck, ShieldAlert, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AddSenderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: SenderListType;
}

export function AddSenderDialog({
  open,
  onOpenChange,
  defaultType = "allow",
}: AddSenderDialogProps) {
  const [type, setType] = useState<SenderListType>(defaultType);
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");

  const createMutation = useCreateSenderEntry();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target.trim()) {
      toast.error("Veuillez saisir une adresse email ou un nom de domaine");
      return;
    }

    try {
      await createMutation.mutateAsync({
        type,
        target: target.trim().toLowerCase(),
        note: note.trim() || undefined,
      });

      toast.success(
        type === "allow"
          ? "Expéditeur ajouté à la liste blanche"
          : "Expéditeur ajouté à la liste noire",
      );
      setTarget("");
      setNote("");
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de l'enregistrement de la règle",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-border bg-card max-w-2xl p-6 shadow-2xl rounded-xl no-scrollbar">
        <DialogHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex size-9 items-center justify-center rounded-lg",
                type === "allow"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-destructive/15 text-destructive",
              )}
            >
              {type === "allow" ? (
                <ShieldCheck className="size-5" />
              ) : (
                <ShieldAlert className="size-5" />
              )}
            </div>
            <div>
              <DialogTitle className="text-base font-semibold font-display">
                Ajouter une règle de confiance
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Définissez les adresses ou domaines toujours acceptés ou bloqués
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {/* Contenu adaptatif : 2 sections côte à côte sur md:, 1 colonne sur mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-4">
            {/* Section 1 : Cible et Type de règle */}
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-semibold text-foreground mb-1.5 block">
                  Action de filtrage
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType("allow")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer",
                      type === "allow"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs"
                        : "border-border text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    <ShieldCheck className="size-3.5" />
                    Liste blanche
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("deny")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer",
                      type === "deny"
                        ? "border-destructive bg-destructive/10 text-destructive font-semibold shadow-xs"
                        : "border-border text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    <ShieldAlert className="size-3.5" />
                    Liste noire
                  </button>
                </div>
              </div>

              <div>
                <Label
                  htmlFor="sender-target"
                  className="text-xs font-semibold text-foreground mb-1.5 block"
                >
                  Adresse ou nom de domaine
                </Label>
                <Input
                  id="sender-target"
                  placeholder="contact@societe.com ou @societe.com"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="h-9 text-xs"
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Exemples : <code>alertes@banque.fr</code> ou <code>@newsletter.fr</code>
                </p>
              </div>
            </div>

            {/* Section 2 : Note explicative et Aide contextuelle */}
            <div className="space-y-4 flex flex-col justify-between">
              <div>
                <Label
                  htmlFor="sender-note"
                  className="text-xs font-semibold text-foreground mb-1.5 block"
                >
                  Note / Mémo (optionnel)
                </Label>
                <Input
                  id="sender-note"
                  placeholder="Ex : Banque principale, fournisseur..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div
                className={cn(
                  "p-3 rounded-lg border text-xs flex items-start gap-2.5",
                  type === "allow"
                    ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-950 dark:text-emerald-200"
                    : "bg-destructive/5 border-destructive/20 text-destructive dark:text-destructive/90",
                )}
              >
                <Info className="size-4 shrink-0 mt-0.5" />
                <div className="leading-relaxed text-[11px]">
                  {type === "allow" ? (
                    <span>
                      Les messages correspondants seront <strong>toujours acceptés</strong> en
                      boîte de réception et protégés contre les faux positifs anti-spam.
                    </span>
                  ) : (
                    <span>
                      Tous les messages correspondants seront <strong>automatiquement redirigés</strong>{" "}
                      vers votre dossier de pourriels (Spam).
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-border/60 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createMutation.isPending || !target.trim()}
              className={cn(
                type === "allow"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-destructive hover:bg-destructive/90 text-white",
              )}
            >
              {createMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                "Enregistrer la règle"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
