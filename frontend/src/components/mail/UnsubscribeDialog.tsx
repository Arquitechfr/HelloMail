"use client";

import { useState } from "react";
import type { UnsubscribeInfo, UnsubscribeResult } from "@/lib/api-types";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, MailX, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export interface UnsubscribeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  folder: string;
  uid: number;
  info: UnsubscribeInfo;
  onSuccess?: () => void;
}

export function UnsubscribeDialog({
  open,
  onOpenChange,
  accountId,
  folder,
  uid,
  info,
  onSuccess,
}: UnsubscribeDialogProps) {
  const [isPending, setIsPending] = useState(false);

  const handleConfirm = async () => {
    setIsPending(true);
    try {
      const res = await apiFetch<UnsubscribeResult>(
        `/api/accounts/${accountId}/messages/${encodeURIComponent(folder)}/${uid}/unsubscribe`,
        { method: "POST" },
      );

      if (res.action === "open_url" && res.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
        toast.info("Lien de désabonnement ouvert dans un nouvel onglet");
      } else {
        toast.success(res.details || "Désabonnement pris en compte avec succès");
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Impossible d'effectuer la demande de désabonnement",
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-border bg-card max-w-md p-6 shadow-2xl rounded-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <MailX className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Se désabonner de cette liste ?
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {info.isOneClick
                  ? "Désabonnement direct en un clic (RFC 8058)"
                  : info.mailto
                    ? "Désabonnement par envoi d'email"
                    : "Lien de désinscription externe"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-3 text-sm text-muted-foreground">
          {info.isOneClick ? (
            <p>
              Cet expéditeur supporte la désinscription standardisée en 1 clic.
              Mailora va transmettre une requête sécurisée pour retirer votre adresse
              de cette liste de diffusion.
            </p>
          ) : info.mailto ? (
            <p>
              Un courriel de demande de désabonnement va être transmis automatiquement
              par Mailora au gestionnaire de la liste de diffusion.
            </p>
          ) : (
            <p>
              Vous allez être redirigé vers la page de gestion des abonnements de l'expéditeur
              pour confirmer votre retrait.
            </p>
          )}
        </div>

        <DialogFooter className="flex gap-2 justify-end pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleConfirm}
            disabled={isPending}
            className="gap-1.5"
          >
            {isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Traitement en cours...
              </>
            ) : info.isOneClick ? (
              <>
                <CheckCircle2 className="size-3.5" />
                Confirmer en 1 clic
              </>
            ) : info.mailto ? (
              <>
                <MailX className="size-3.5" />
                Envoyer la demande
              </>
            ) : (
              <>
                <ExternalLink className="size-3.5" />
                Ouvrir la page
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
