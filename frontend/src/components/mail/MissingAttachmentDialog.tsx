"use client";

import { Paperclip, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface MissingAttachmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddAttachment: () => void;
  onConfirmSend: () => void;
}

export function MissingAttachmentDialog({
  open,
  onOpenChange,
  onAddAttachment,
  onConfirmSend,
}: MissingAttachmentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="flex flex-col items-center sm:items-start text-center sm:text-left">
          <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 mb-2">
            <Paperclip className="size-5" />
          </div>
          <DialogTitle className="text-base font-semibold font-display">
            Pièce jointe manquante ?
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Votre message semble faire référence à une pièce jointe, mais aucun fichier n&apos;est actuellement attaché.
          </DialogDescription>
        </DialogHeader>

        <div className="p-3 rounded-md bg-muted/40 border border-border/50 text-[11px] text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-500 shrink-0" />
          <span>Souhaitez-vous joindre un document avant l&apos;envoi ?</span>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onConfirmSend}
            className="text-xs"
          >
            Envoyer quand même
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onAddAttachment}
            className="text-xs gap-1.5"
          >
            <Paperclip className="size-3.5" />
            <span>Ajouter une pièce jointe</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
