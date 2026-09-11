"use client";

import { useDeleteFolder } from "@/lib/queries/folders";
import type { FolderInfo } from "@/lib/api-types";
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
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export interface FolderDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  folder: FolderInfo | null;
  onSuccess?: () => void;
}

export function FolderDeleteDialog({
  open,
  onOpenChange,
  accountId,
  folder,
  onSuccess,
}: FolderDeleteDialogProps) {
  const deleteFolder = useDeleteFolder(accountId);

  if (!folder) return null;

  const handleDelete = () => {
    deleteFolder.mutate(folder.path, {
      onSuccess: () => {
        toast.success(`Le dossier « ${folder.name || folder.path} » a été supprimé`);
        onOpenChange(false);
        onSuccess?.();
      },
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : "Erreur lors de la suppression du dossier");
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-border bg-card max-w-md p-6 shadow-2xl rounded-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Supprimer ce dossier ?</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Cette action est irréversible sur le serveur IMAP.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2 text-xs text-muted-foreground leading-relaxed">
          Êtes-vous sûr de vouloir supprimer définitivement le dossier{" "}
          <strong className="text-foreground">{folder.name || folder.path}</strong> ? Tous les
          messages qu&apos;il contient ainsi que ses éventuels sous-dossiers seront définitivement
          effacés.
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteFolder.isPending}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteFolder.isPending}
          >
            {deleteFolder.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Suppression...
              </>
            ) : (
              "Supprimer définitivement"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
