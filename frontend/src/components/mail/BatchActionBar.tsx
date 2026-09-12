"use client";

import { useMemo } from "react";
import { useUIStore } from "@/lib/stores/uiStore";
import { useBatchAction } from "@/lib/queries/messages";
import { useBatchSetMessageTags } from "@/lib/queries/tags";
import { useFolders } from "@/lib/queries/folders";
import { useTags } from "@/lib/queries/tags";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Mail,
  MailOpen,
  Pin,
  PinOff,
  FolderInput,
  Tag as TagIcon,
  ShieldAlert,
  Trash2,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { BatchActionType } from "@/lib/api-types";

interface BatchActionBarProps {
  accountId: string;
  folder: string;
  className?: string;
  totalSelectable?: number;
  onSelectAll?: () => void;
}

export function BatchActionBar({
  accountId,
  folder,
  className,
  totalSelectable,
  onSelectAll,
}: BatchActionBarProps) {
  const selectedUids = useUIStore((s) => s.selectedUids);
  const clearSelectedUids = useUIStore((s) => s.clearSelectedUids);

  const { mutate: executeBatch, isPending: isBatchPending } = useBatchAction(accountId);
  const { mutate: executeTagsBatch, isPending: isTagsPending } = useBatchSetMessageTags();
  const { data: folders } = useFolders(accountId);
  const { data: tagsData } = useTags();

  const isPending = isBatchPending || isTagsPending;

  const availableFolders = useMemo(() => {
    if (!folders) return [];
    return folders.filter((f) => f.path !== folder && !f.flags.includes("\\Noselect"));
  }, [folders, folder]);

  if (selectedUids.length === 0) {
    return null;
  }

  const handleBatch = (action: BatchActionType, destination?: string) => {
    executeBatch(
      {
        uids: selectedUids,
        action,
        folder,
        destination,
      },
      {
        onSuccess: () => {
          const count = selectedUids.length;
          const msg =
            action === "markRead"
              ? `${count} email${count > 1 ? "s" : ""} marqué${count > 1 ? "s" : ""} comme lu${count > 1 ? "s" : ""}`
              : action === "markUnread"
                ? `${count} email${count > 1 ? "s" : ""} marqué${count > 1 ? "s" : ""} comme non lu${count > 1 ? "s" : ""}`
                : action === "pin"
                  ? `${count} email${count > 1 ? "s" : ""} mis en avant`
                  : action === "unpin"
                    ? `${count} email${count > 1 ? "s" : ""} retiré${count > 1 ? "s" : ""} de la mise en avant`
                    : action === "move"
                      ? `${count} email${count > 1 ? "s" : ""} déplacé${count > 1 ? "s" : ""}`
                      : action === "delete"
                        ? `${count} email${count > 1 ? "s" : ""} supprimé${count > 1 ? "s" : ""}`
                        : `${count} email${count > 1 ? "s" : ""} traité${count > 1 ? "s" : ""}`;
          toast.success(msg);
          clearSelectedUids();
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Erreur lors de l'action groupée");
        },
      },
    );
  };

  const handleApplyTag = (tagName: string) => {
    executeTagsBatch(
      {
        accountId,
        folder,
        uids: selectedUids,
        tags: [tagName],
        mode: "add",
      },
      {
        onSuccess: () => {
          toast.success(`Étiquette « ${tagName} » appliquée à ${selectedUids.length} email(s)`);
          clearSelectedUids();
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Erreur lors de l'application de l'étiquette");
        },
      },
    );
  };

  const count = selectedUids.length;
  const canSelectAll = totalSelectable !== undefined && totalSelectable > count && !!onSelectAll;

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          key="batch-actions-dock"
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className={cn(
            "absolute bottom-3 inset-x-3 z-30 flex items-center justify-between gap-1.5 rounded-xl border border-primary/25 bg-card/95 backdrop-blur-md px-3 py-1.5 shadow-xl text-xs",
            className,
          )}
        >
          {/* Compteur & sélection */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-semibold text-foreground whitespace-nowrap">
              {count} <span className="text-muted-foreground font-normal">sélectionné{count > 1 ? "s" : ""}</span>
            </span>
            {canSelectAll && (
              <button
                type="button"
                onClick={onSelectAll}
                title="Tout sélectionner (Ctrl+A)"
                className="text-[11px] text-primary hover:underline font-medium shrink-0 ml-1 cursor-pointer"
              >
                Tout ({totalSelectable})
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 shrink-0">
            {isPending ? (
              <Loader2 className="size-4 animate-spin text-primary mx-2" />
            ) : (
              <>
                {/* Lu / Non-lu */}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Marquer comme lu (U)"
                  aria-label="Marquer comme lu"
                  onClick={() => handleBatch("markRead")}
                >
                  <MailOpen className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Marquer comme non lu (U)"
                  aria-label="Marquer comme non lu"
                  onClick={() => handleBatch("markUnread")}
                >
                  <Mail className="size-3.5" />
                </Button>

                {/* Épingler / Désépingler */}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Mettre en avant (H)"
                  aria-label="Mettre en avant"
                  onClick={() => handleBatch("pin")}
                >
                  <Pin className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Retirer la mise en avant (H)"
                  aria-label="Retirer la mise en avant"
                  onClick={() => handleBatch("unpin")}
                >
                  <PinOff className="size-3.5" />
                </Button>

                {/* Déplacer vers */}
                {availableFolders.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="inline-flex size-6 items-center justify-center rounded-[min(var(--radius-md),10px)] text-muted-foreground hover:bg-muted hover:text-foreground outline-none transition-colors"
                      title="Déplacer vers un dossier"
                      aria-label="Déplacer vers"
                    >
                      <FolderInput className="size-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 max-h-56 overflow-y-auto">
                      {availableFolders.map((f) => (
                        <DropdownMenuItem key={f.path} onClick={() => handleBatch("move", f.path)}>
                          <span className="truncate">{f.name || f.path}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Étiquettes */}
                {tagsData?.data && tagsData.data.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="inline-flex size-6 items-center justify-center rounded-[min(var(--radius-md),10px)] text-muted-foreground hover:bg-muted hover:text-foreground outline-none transition-colors"
                      title="Appliquer une étiquette"
                      aria-label="Appliquer une étiquette"
                    >
                      <TagIcon className="size-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 max-h-56 overflow-y-auto">
                      {tagsData.data.map((t) => (
                        <DropdownMenuItem key={t.id} onClick={() => handleApplyTag(t.name)}>
                          <span
                            className="size-2 rounded-full mr-2 shrink-0"
                            style={{ backgroundColor: t.color }}
                          />
                          <span className="truncate">{t.name}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Indésirable */}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Signaler comme spam (!)"
                  aria-label="Marquer comme indésirable"
                  onClick={() => handleBatch("markAsJunk")}
                >
                  <ShieldAlert className="size-3.5" />
                </Button>

                {/* Supprimer */}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-destructive hover:bg-destructive/10"
                  title="Supprimer (Suppr)"
                  aria-label="Supprimer"
                  onClick={() => handleBatch("delete")}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </>
            )}

            {/* Annuler / Vider la sélection */}
            <div className="h-4 w-px bg-border/80 mx-1" />
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={clearSelectedUids}
              title="Annuler la sélection (Échap)"
              aria-label="Annuler la sélection"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
