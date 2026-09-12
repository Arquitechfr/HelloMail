"use client";

import { useEmptyFolder } from "@/lib/queries/folders";
import { isTrashFolder } from "@/lib/folder-utils";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export interface EmptyFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  folderPath: string;
  folderName?: string;
  messageCount?: number;
  onSuccess?: () => void;
}

export function EmptyFolderDialog({
  open,
  onOpenChange,
  accountId,
  folderPath,
  folderName,
  messageCount,
  onSuccess,
}: EmptyFolderDialogProps) {
  const emptyFolder = useEmptyFolder(accountId);
  const isTrash = isTrashFolder(folderPath);

  const displayName = folderName || folderPath;
  const title = isTrash ? "Vider la corbeille ?" : `Vider le dossier « ${displayName} » ?`;
  const actionLabel = isTrash ? "Vider la corbeille" : "Vider le dossier";

  const handleEmpty = () => {
    emptyFolder.mutate(folderPath, {
      onSuccess: (data) => {
        toast.success(
          data.deletedCount > 0
            ? `${data.deletedCount} message${data.deletedCount > 1 ? "s" : ""} supprimé${
                data.deletedCount > 1 ? "s" : ""
              } définitivement`
            : "Le dossier est désormais vide"
        );
        onOpenChange(false);
        onSuccess?.();
      },
      onError: (err) => {
        toast.error(
          err instanceof ApiError ? err.message : "Erreur lors du vidage du dossier"
        );
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-border bg-card max-w-md p-6 shadow-2xl rounded-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
              <Trash2 className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Cette action est irréversible et efface définitivement tous les messages.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2 text-xs text-muted-foreground leading-relaxed">
          {messageCount !== undefined && messageCount > 0 ? (
            <p>
              Êtes-vous sûr de vouloir vider{" "}
              <strong className="text-foreground">{displayName}</strong> ? Les{" "}
              <strong className="text-foreground">{messageCount}</strong> message
              {messageCount > 1 ? "s" : ""} qu&apos;il contient seront immédiatement et
              définitivement effacés du serveur IMAP.
            </p>
          ) : (
            <p>
              Êtes-vous sûr de vouloir vider le dossier{" "}
              <strong className="text-foreground">{displayName}</strong> ? Tous les
              messages qu&apos;il contient seront définitivement effacés du serveur IMAP.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={emptyFolder.isPending}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleEmpty}
            disabled={emptyFolder.isPending}
          >
            {emptyFolder.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Vidage en cours...
              </>
            ) : (
              actionLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
