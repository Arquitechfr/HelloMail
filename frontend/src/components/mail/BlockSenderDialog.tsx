"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useUIStore } from "@/lib/stores/uiStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export interface BlockSenderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  folder: string;
  uid: number;
  senderEmail: string;
  onSuccess?: () => void;
}

export function BlockSenderDialog({
  open,
  onOpenChange,
  accountId,
  folder,
  uid,
  senderEmail,
  onSuccess,
}: BlockSenderDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();
  const selectedUid = useUIStore((s) => s.selectedUid);
  const setSelectedUid = useUIStore((s) => s.setSelectedUid);

  const handleBlock = async () => {
    setIsPending(true);
    try {
      const res = await apiFetch<{ message: string }>(
        `/api/accounts/${accountId}/messages/${encodeURIComponent(folder)}/${uid}/block-sender`,
        { method: "POST" },
      );

      toast.success(res.message || `Expéditeur ${senderEmail} bloqué`);
      onOpenChange(false);

      // Invalidation de la liste et fermeture de la vue message si ouvert
      queryClient.invalidateQueries({ queryKey: ["messages", accountId, folder] });
      queryClient.invalidateQueries({ queryKey: ["folders", accountId] });
      if (selectedUid === uid) {
        setSelectedUid(null);
      }

      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Impossible de bloquer cet expéditeur",
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
            <div className="flex size-9 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Bloquer cet expéditeur ?
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {senderEmail}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-3 text-sm text-muted-foreground">
          <p>
            Tous les prochains messages envoyés par{" "}
            <strong className="text-foreground">{senderEmail}</strong> seront
            automatiquement redirigés vers vos courriers indésirables (Spam).
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Ce message va également être immédiatement déplacé dans votre dossier de spam.
          </p>
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
            variant="destructive"
            size="sm"
            onClick={handleBlock}
            disabled={isPending}
            className="gap-1.5"
          >
            {isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Blocage en cours...
              </>
            ) : (
              <>
                <ShieldAlert className="size-3.5" />
                Bloquer et déplacer en spam
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
