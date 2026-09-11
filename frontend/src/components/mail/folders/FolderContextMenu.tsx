"use client";

import React from "react";
import { isProtectedFolder } from "@/lib/folder-utils";
import type { FolderInfo } from "@/lib/api-types";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { FolderPlus, Pencil, Trash2, Shield } from "lucide-react";

export interface FolderContextMenuProps {
  folder: FolderInfo;
  onCreateSubfolder: (parent: FolderInfo) => void;
  onRename: (folder: FolderInfo) => void;
  onDelete: (folder: FolderInfo) => void;
  children: React.ReactNode;
}

export function FolderContextMenu({
  folder,
  onCreateSubfolder,
  onRename,
  onDelete,
  children,
}: FolderContextMenuProps) {
  const protectedFolder = isProtectedFolder(folder);

  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>

      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={() => onCreateSubfolder(folder)}>
          <FolderPlus className="size-4 mr-2 text-muted-foreground" />
          <span>Nouveau sous-dossier</span>
          <ContextMenuShortcut>⇧N</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        {protectedFolder ? (
          <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground select-none italic">
            <Shield className="size-3.5 text-muted-foreground/70" />
            <span>Dossier système protégé</span>
          </div>
        ) : (
          <>
            <ContextMenuItem onClick={() => onRename(folder)}>
              <Pencil className="size-4 mr-2 text-muted-foreground" />
              <span>Renommer</span>
              <ContextMenuShortcut>F2</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem
              variant="destructive"
              onClick={() => onDelete(folder)}
            >
              <Trash2 className="size-4 mr-2 text-destructive" />
              <span>Supprimer</span>
              <ContextMenuShortcut>Suppr</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
