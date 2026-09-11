"use client";

import { useState, useEffect } from "react";
import { useFolders } from "@/lib/queries/folders";
import { cn } from "@/lib/utils";
import { isProtectedFolder } from "@/lib/folder-utils";
import type { FolderInfo } from "@/lib/api-types";
import { FolderNodeItem, type FolderNode } from "./folders/FolderNodeItem";
import { FolderFormDialog, type FolderFormDialogProps } from "./folders/FolderFormDialog";
import { FolderDeleteDialog } from "./folders/FolderDeleteDialog";
import { FolderPlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface FolderTreeProps {
  accountId: string;
  accountColor?: string;
  selectedFolder: string;
  onSelectFolder: (path: string) => void;
}

/** Construit une arborescence à partir de la liste plate des dossiers. */
function buildTree(folders: FolderInfo[]): FolderNode[] {
  const map = new Map<string, FolderNode>();
  const roots: FolderNode[] = [];

  for (const f of folders) {
    map.set(f.path, { ...f, children: [] });
  }

  for (const f of folders) {
    const node = map.get(f.path)!;
    const delimiter = f.delimiter || "/";
    const parentPath = f.path.includes(delimiter)
      ? f.path.substring(0, f.path.lastIndexOf(delimiter))
      : "";

    if (parentPath && map.has(parentPath)) {
      map.get(parentPath)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function FolderTree({ accountId, accountColor, selectedFolder, onSelectFolder }: FolderTreeProps) {
  const { data: folders, isLoading, error } = useFolders(accountId);

  const [formDialog, setFormDialog] = useState<{
    open: boolean;
    mode: FolderFormDialogProps["mode"];
    parentFolder?: FolderInfo | null;
    currentFolder?: FolderInfo | null;
  }>({
    open: false,
    mode: "create",
  });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    folder: FolderInfo | null;
  }>({
    open: false,
    folder: null,
  });

  const activeFolderObj = folders?.find((f) => f.path === selectedFolder);
  const delimiter = folders?.[0]?.delimiter || "/";

  // Raccourcis clavier (Shift+N sous-dossier, F2 renommer, Delete supprimer)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isElement = e.target instanceof Element;
      const isInput =
        isElement &&
        (e.target.tagName === "INPUT" ||
          e.target.tagName === "TEXTAREA" ||
          (e.target as HTMLElement).isContentEditable ||
          Boolean(e.target.closest(".tiptap")) ||
          Boolean(e.target.closest("[contenteditable='true']")));

      if (isInput) return;

      const hasModal = !!document.querySelector(
        "[data-slot='dialog-content'], [role='dialog']",
      );
      if (hasModal) return;

      if ((e.key === "N" || e.key === "n") && e.shiftKey && !e.metaKey && !e.ctrlKey) {
        if (activeFolderObj) {
          e.preventDefault();
          setFormDialog({
            open: true,
            mode: "create-subfolder",
            parentFolder: activeFolderObj,
          });
        }
      } else if (e.key === "F2" && !e.metaKey && !e.ctrlKey) {
        if (activeFolderObj && !isProtectedFolder(activeFolderObj)) {
          e.preventDefault();
          setFormDialog({
            open: true,
            mode: "rename",
            currentFolder: activeFolderObj,
          });
        }
      } else if ((e.key === "Delete" || e.key === "Del") && !e.metaKey && !e.ctrlKey) {
        if (activeFolderObj && !isProtectedFolder(activeFolderObj)) {
          e.preventDefault();
          setDeleteDialog({
            open: true,
            folder: activeFolderObj,
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeFolderObj]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        Impossible de charger les dossiers
      </div>
    );
  }

  if (!folders || folders.length === 0) {
    return <div className="p-3 text-xs text-muted-foreground">Aucun dossier</div>;
  }

  const tree = buildTree(folders);

  return (
    <div className="flex flex-col gap-0.5">
      {/* En-tête dossiers avec bouton création racine */}
      <div className="flex items-center justify-between px-2 py-1 mb-0.5">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Dossiers
        </span>
        <button
          type="button"
          onClick={() => setFormDialog({ open: true, mode: "create" })}
          title="Nouveau dossier racine"
          className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          aria-label="Nouveau dossier racine"
        >
          <FolderPlus className="size-3.5" />
        </button>
      </div>

      {tree.map((node) => (
        <FolderNodeItem
          key={node.path}
          node={node}
          depth={0}
          selectedFolder={selectedFolder}
          accountId={accountId}
          accountColor={accountColor}
          onSelectFolder={onSelectFolder}
          onCreateSubfolder={(parent) =>
            setFormDialog({ open: true, mode: "create-subfolder", parentFolder: parent })
          }
          onRename={(folder) =>
            setFormDialog({ open: true, mode: "rename", currentFolder: folder })
          }
          onDelete={(folder) => setDeleteDialog({ open: true, folder })}
        />
      ))}

      {/* Modale de formulaire (création / sous-dossier / renommage) */}
      <FolderFormDialog
        open={formDialog.open}
        onOpenChange={(open) => setFormDialog((s) => ({ ...s, open }))}
        mode={formDialog.mode}
        accountId={accountId}
        delimiter={delimiter}
        parentFolder={formDialog.parentFolder}
        currentFolder={formDialog.currentFolder}
        onSuccess={(newPath) => {
          onSelectFolder(newPath);
        }}
      />

      {/* Modale de confirmation de suppression */}
      <FolderDeleteDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((s) => ({ ...s, open }))}
        accountId={accountId}
        folder={deleteDialog.folder}
        onSuccess={() => {
          if (deleteDialog.folder && selectedFolder === deleteDialog.folder.path) {
            onSelectFolder("INBOX");
          }
        }}
      />
    </div>
  );
}

