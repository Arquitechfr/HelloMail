"use client";

import { isProtectedFolder } from "@/lib/folder-utils";
import type { FolderInfo } from "@/lib/api-types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FolderPlus, Pencil, Trash2, MoreVertical, Shield, Upload } from "lucide-react";

export interface FolderActionsMenuProps {
  folder: FolderInfo;
  accountId: string;
  onCreateSubfolder: (parent: FolderInfo) => void;
  onRename: (folder: FolderInfo) => void;
  onDelete: (folder: FolderInfo) => void;
  onImportEml: (folder: FolderInfo) => void;
}

export function FolderActionsMenu({
  folder,
  onCreateSubfolder,
  onRename,
  onDelete,
  onImportEml,
}: FolderActionsMenuProps) {
  const protectedFolder = isProtectedFolder(folder);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        data-slot="folder-actions-trigger"
        aria-label={`Actions pour le dossier ${folder.name}`}
        onClick={(e) => {
          e.stopPropagation();
        }}
        className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100 data-open:opacity-100 shrink-0"
      >
        <MoreVertical className="size-3.5" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onCreateSubfolder(folder);
          }}
        >
          <FolderPlus className="size-3.5 mr-2 text-muted-foreground" />
          Nouveau sous-dossier
          <DropdownMenuShortcut>⇧N</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onImportEml(folder);
          }}
        >
          <Upload className="size-3.5 mr-2 text-muted-foreground" />
          Importer des messages (.eml)
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {protectedFolder ? (
          <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground select-none italic">
            <Shield className="size-3 text-muted-foreground/70" />
            Dossier système protégé
          </div>
        ) : (
          <>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onRename(folder);
              }}
            >
              <Pencil className="size-3.5 mr-2 text-muted-foreground" />
              Renommer
              <DropdownMenuShortcut>F2</DropdownMenuShortcut>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDelete(folder);
              }}
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <Trash2 className="size-3.5 mr-2 text-destructive" />
              Supprimer
              <DropdownMenuShortcut>Suppr</DropdownMenuShortcut>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
