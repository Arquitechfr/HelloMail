"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUIStore } from "@/lib/stores/uiStore";
import {
  useSmartFolders,
  useSmartFolderCounts,
  useDeleteSmartFolder,
} from "@/lib/queries/smartFolders";
import type { SmartFolder } from "@/lib/api-types";
import { SmartFolderDialog, SMART_FOLDER_ICONS } from "./SmartFolderDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sparkles, Plus, MoreVertical, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function SmartFolderList() {
  const router = useRouter();
  const pathname = usePathname();
  const { setSelectedAccount, setSelectedFolder, setMobileSidebarOpen } = useUIStore();

  const { data: smartFoldersRes, isLoading } = useSmartFolders();
  const { data: countsRes } = useSmartFolderCounts();
  const deleteMutation = useDeleteSmartFolder();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<SmartFolder | null>(null);

  const smartFolders = smartFoldersRes?.data || [];
  const counts = countsRes?.data || {};

  const handleSelect = (folder: SmartFolder) => {
    setSelectedAccount(null);
    setSelectedFolder(`smart:${folder._id}`);
    setMobileSidebarOpen(false);
    router.push(`/mail/smart/${folder._id}`);
  };

  const handleOpenCreate = () => {
    setEditingFolder(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (folder: SmartFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFolder(folder);
    setDialogOpen(true);
  };

  const handleDelete = async (folder: SmartFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Supprimer le dossier intelligent "${folder.name}" ?`)) return;

    try {
      await deleteMutation.mutateAsync(folder._id);
      toast.success("Dossier intelligent supprimé");
      if (pathname === `/mail/smart/${folder._id}`) {
        router.push("/mail");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de la suppression du dossier intelligent",
      );
    }
  };

  if (isLoading && smartFolders.length === 0) {
    return null;
  }

  return (
    <div className="mb-3 pb-2.5 border-b border-border/60 px-1">
      {/* En-tête de section avec bouton d'ajout */}
      <div className="flex items-center justify-between px-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="size-3.5 text-amber-500 shrink-0" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
            Dossiers intelligents
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
          onClick={handleOpenCreate}
          title="Nouveau dossier intelligent"
          aria-label="Nouveau dossier intelligent"
        >
          <Plus className="size-3" />
        </Button>
      </div>

      {/* Liste des dossiers intelligents */}
      {smartFolders.length === 0 ? (
        <div className="px-2 py-1.5 text-center">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          >
            + Créer un dossier virtuel
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {smartFolders.map((folder) => {
            const isSelected = pathname === `/mail/smart/${folder._id}`;
            const folderCount = counts[folder._id];
            const unread = folderCount?.unread ?? 0;
            const total = folderCount?.total ?? 0;
            const IconComponent = (folder.icon && SMART_FOLDER_ICONS[folder.icon]) || Sparkles;

            return (
              <div
                key={folder._id}
                onClick={() => handleSelect(folder)}
                className={cn(
                  "group flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer select-none",
                  isSelected
                    ? "bg-primary/15 text-primary font-medium shadow-2xs"
                    : "text-foreground/80 hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <div className="flex items-center gap-2 truncate min-w-0">
                  <div
                    className="flex size-4 items-center justify-center shrink-0 rounded-xs"
                    style={{ color: folder.color || "#3b82f6" }}
                  >
                    <IconComponent className="size-3.5" />
                  </div>
                  <span className="truncate">{folder.name}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {unread > 0 ? (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-primary text-primary-foreground">
                      {unread}
                    </span>
                  ) : total > 0 ? (
                    <span className="text-[10px] text-muted-foreground group-hover:text-foreground/80">
                      {total}
                    </span>
                  ) : null}

                  {/* Menu contextuel discret */}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-background/80 transition-opacity cursor-pointer"
                      title="Options"
                      aria-label="Options du dossier intelligent"
                    >
                      <MoreVertical className="size-3" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem
                        onClick={(e) => handleOpenEdit(folder, e)}
                        className="text-xs cursor-pointer"
                      >
                        <Edit2 className="size-3.5 mr-2" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => handleDelete(folder, e)}
                        className="text-xs text-destructive focus:text-destructive cursor-pointer"
                      >
                        <Trash2 className="size-3.5 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de création / édition */}
      <SmartFolderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        folderToEdit={editingFolder}
      />
    </div>
  );
}
