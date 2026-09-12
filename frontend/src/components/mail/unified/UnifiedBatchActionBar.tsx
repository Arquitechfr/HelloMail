"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUIStore } from "@/lib/stores/uiStore";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Mail,
  MailOpen,
  Pin,
  PinOff,
  ShieldAlert,
  Trash2,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Message, BatchActionType } from "@/lib/api-types";

interface UnifiedBatchActionBarProps {
  messages: (Message & { accountId: string; folder: string })[];
  totalSelectable?: number;
  onSelectAll?: () => void;
  className?: string;
}

export function UnifiedBatchActionBar({
  messages,
  totalSelectable,
  onSelectAll,
  className,
}: UnifiedBatchActionBarProps) {
  const selectedUids = useUIStore((s) => s.selectedUids);
  const clearSelectedUids = useUIStore((s) => s.clearSelectedUids);
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  const selectedMessages = useMemo(
    () => messages.filter((m) => selectedUids.includes(m.uid)),
    [messages, selectedUids],
  );

  if (selectedUids.length === 0) {
    return null;
  }

  const handleBatch = async (action: BatchActionType) => {
    setIsPending(true);
    try {
      // Regrouper par accountId + folder
      const groups = new Map<string, { accountId: string; folder: string; uids: number[] }>();
      for (const msg of selectedMessages) {
        const key = `${msg.accountId}:${msg.folder}`;
        let group = groups.get(key);
        if (!group) {
          group = { accountId: msg.accountId, folder: msg.folder, uids: [] };
          groups.set(key, group);
        }
        group.uids.push(msg.uid);
      }

      await Promise.all(
        Array.from(groups.values()).map((g) =>
          apiFetch(`/api/accounts/${g.accountId}/messages/batch`, {
            method: "POST",
            body: JSON.stringify({
              uids: g.uids,
              action,
              folder: g.folder,
            }),
          }),
        ),
      );

      // Invalider les requêtes de messages et boîtes unifiées
      queryClient.invalidateQueries({ queryKey: ["unified"] });
      queryClient.invalidateQueries({ queryKey: ["messages"] });

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
                : action === "delete"
                  ? `${count} email${count > 1 ? "s" : ""} supprimé${count > 1 ? "s" : ""}`
                  : `${count} email${count > 1 ? "s" : ""} traité${count > 1 ? "s" : ""}`;
      toast.success(msg);
      clearSelectedUids();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'action groupée");
    } finally {
      setIsPending(false);
    }
  };

  const count = selectedUids.length;
  const canSelectAll = totalSelectable !== undefined && totalSelectable > count && !!onSelectAll;

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          key="unified-batch-actions-dock"
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

                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Signaler comme spam (!)"
                  aria-label="Marquer comme indésirable"
                  onClick={() => handleBatch("markAsJunk")}
                >
                  <ShieldAlert className="size-3.5" />
                </Button>

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
