"use client";

import { useState, useEffect } from "react";
import { useCreateFolder, useRenameFolder } from "@/lib/queries/folders";
import {
  getBaseFolderName,
  getParentPath,
  buildSubFolderPath,
  validateFolderName,
} from "@/lib/folder-utils";
import type { FolderInfo } from "@/lib/api-types";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, FolderPlus, Pencil, Folder } from "lucide-react";
import { toast } from "sonner";

export interface FolderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "create-subfolder" | "rename";
  accountId: string;
  delimiter?: string;
  parentFolder?: FolderInfo | null;
  currentFolder?: FolderInfo | null;
  onSuccess?: (newPath: string) => void;
}

export function FolderFormDialog({
  open,
  onOpenChange,
  mode,
  accountId,
  delimiter = "/",
  parentFolder,
  currentFolder,
  onSuccess,
}: FolderFormDialogProps) {
  const [name, setName] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createFolder = useCreateFolder(accountId);
  const renameFolder = useRenameFolder(accountId);

  const isPending = createFolder.isPending || renameFolder.isPending;

  useEffect(() => {
    if (open) {
      if (mode === "rename" && currentFolder) {
        setName(getBaseFolderName(currentFolder.path, delimiter));
      } else {
        setName("");
      }
      setErrorMsg(null);
    }
  }, [open, mode, currentFolder, delimiter]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateFolderName(name, delimiter);
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    if (mode === "rename" && currentFolder) {
      const parent = getParentPath(currentFolder.path, delimiter);
      const newPath = buildSubFolderPath(parent, name, delimiter);

      if (newPath === currentFolder.path) {
        onOpenChange(false);
        return;
      }

      renameFolder.mutate(
        { path: currentFolder.path, newPath },
        {
          onSuccess: () => {
            toast.success("Dossier renommé avec succès");
            onOpenChange(false);
            onSuccess?.(newPath);
          },
          onError: (err) => {
            setErrorMsg(err instanceof ApiError ? err.message : "Erreur lors du renommage");
          },
        }
      );
    } else {
      const parentPath = mode === "create-subfolder" && parentFolder ? parentFolder.path : null;
      const finalPath = buildSubFolderPath(parentPath, name, delimiter);

      createFolder.mutate(finalPath, {
        onSuccess: () => {
          toast.success(
            mode === "create-subfolder" ? "Sous-dossier créé avec succès" : "Dossier créé avec succès"
          );
          onOpenChange(false);
          onSuccess?.(finalPath);
        },
        onError: (err) => {
          setErrorMsg(err instanceof ApiError ? err.message : "Erreur lors de la création");
        },
      });
    }
  };

  const previewPath =
    mode === "create-subfolder" && parentFolder
      ? buildSubFolderPath(parentFolder.path, name || "...", delimiter)
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-border bg-card max-w-md p-6 shadow-2xl rounded-xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {mode === "rename" ? (
                <Pencil className="size-4" />
              ) : (
                <FolderPlus className="size-4" />
              )}
            </div>
            <DialogTitle>
              {mode === "rename"
                ? "Renommer le dossier"
                : mode === "create-subfolder"
                ? "Nouveau sous-dossier"
                : "Nouveau dossier"}
            </DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          {mode === "create-subfolder" && parentFolder && (
            <div className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              <Folder className="size-3.5 shrink-0 text-foreground/70" />
              <span className="truncate">
                Dossier parent : <strong>{parentFolder.name || parentFolder.path}</strong>
              </span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="folder-name">Nom du dossier</Label>
            <Input
              id="folder-name"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrorMsg(null);
              }}
              placeholder={mode === "rename" ? "Nouveau nom..." : "Ex: Projets, Factures..."}
              required
            />
            {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}
          </div>

          {previewPath && (
            <p className="text-xs text-muted-foreground truncate">
              Chemin complet : <code className="text-foreground">{previewPath}</code>
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  {mode === "rename" ? "Renommage..." : "Création..."}
                </>
              ) : mode === "rename" ? (
                "Renommer"
              ) : (
                "Créer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
