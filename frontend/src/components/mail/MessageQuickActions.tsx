"use client";

import React from "react";
import type { Message } from "@/lib/api-types";
import { useMessageActions } from "@/lib/hooks/useMessageActions";
import { useFolders } from "@/lib/queries/folders";
import { useTags } from "@/lib/queries/tags";
import { getSnoozePresets } from "@/lib/types/snooze";
import { isDraftFolder } from "@/lib/folder-utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Mail,
  MailOpen,
  Star,
  Archive,
  Trash2,
  MoreVertical,
  Reply,
  ReplyAll,
  Forward,
  Clock,
  FolderInput,
  Tag as TagIcon,
  Ban,
  Printer,
  Download,
  RotateCcw,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageQuickActionsProps {
  accountId: string;
  folder: string;
  message: Message;
  className?: string;
}

export function MessageQuickActions({
  accountId,
  folder,
  message,
  className,
}: MessageQuickActionsProps) {
  const actions = useMessageActions({ accountId, folder, message });
  const { data: folders } = useFolders(accountId);
  const { data: tagsData } = useTags();
  const isDraft = isDraftFolder(folder, folders);

  const isUnread = !message.flags.seen;
  const isFlagged = message.flags.flagged;
  const isSnoozed = !!message.snoozedUntil;
  const hasMultipleRecipients = (message.to?.length ?? 0) > 1;

  const handleAction = (e: React.MouseEvent, fn: () => void) => {
    e.stopPropagation();
    fn();
  };

  const availableFolders = (folders ?? []).filter((f) => f.path !== folder);
  const snoozePresets = getSnoozePresets();

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-md bg-background/90 backdrop-blur-xs p-0.5 border border-border/40 shadow-xs",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Lu / Non lu */}
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground hover:text-foreground"
        title={isUnread ? "Marquer comme lu (U)" : "Marquer comme non lu (U)"}
        aria-label={isUnread ? "Marquer comme lu" : "Marquer comme non lu"}
        onClick={(e) => handleAction(e, actions.toggleSeen)}
      >
        {isUnread ? <MailOpen className="size-3.5" /> : <Mail className="size-3.5" />}
      </Button>

      {/* 2. Important / Étoile */}
      <Button
        variant="ghost"
        size="icon-xs"
        className={cn(
          "text-muted-foreground hover:text-foreground",
          isFlagged && "text-amber-400 hover:text-amber-500",
        )}
        title={isFlagged ? "Retirer des messages importants (S)" : "Marquer comme important (S)"}
        aria-label="Important"
        onClick={(e) => handleAction(e, actions.toggleFlagged)}
      >
        <Star className={cn("size-3.5", isFlagged && "fill-amber-400 text-amber-400")} />
      </Button>

      {/* 3. Action rapide contextuelle : Modifier (si brouillon) ou Archiver */}
      {isDraft ? (
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-primary hover:text-primary hover:bg-primary/10"
          title="Modifier le brouillon (E)"
          aria-label="Modifier le brouillon"
          onClick={(e) => handleAction(e, actions.editDraft)}
        >
          <Pencil className="size-3.5" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground"
          title="Archiver (E)"
          aria-label="Archiver"
          onClick={(e) => handleAction(e, actions.archiveMessage)}
        >
          <Archive className="size-3.5" />
        </Button>
      )}

      {/* 4. Supprimer */}
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground hover:text-destructive"
        title={isDraft ? "Supprimer le brouillon (Suppr)" : "Supprimer (Suppr)"}
        aria-label="Supprimer"
        onClick={(e) => handleAction(e, () => actions.deleteMsg(false))}
      >
        <Trash2 className="size-3.5" />
      </Button>

      {/* 5. Menu Plus d'actions (⋮) */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex size-6 items-center justify-center rounded-[min(var(--radius-md),10px)] text-muted-foreground hover:bg-muted hover:text-foreground outline-none transition-colors"
          title="Plus d'actions"
          aria-label="Plus d'actions"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="size-3.5" />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          side="bottom"
          className="w-56"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Rédaction / Réponse */}
          {isDraft ? (
            <DropdownMenuItem onClick={actions.editDraft}>
              <Pencil className="size-4 mr-2" />
              <span>Modifier le brouillon</span>
              <DropdownMenuShortcut>E</DropdownMenuShortcut>
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem onClick={actions.reply}>
                <Reply className="size-4 mr-2" />
                <span>Répondre</span>
                <DropdownMenuShortcut>R</DropdownMenuShortcut>
              </DropdownMenuItem>

              {hasMultipleRecipients && (
                <DropdownMenuItem onClick={actions.replyAll}>
                  <ReplyAll className="size-4 mr-2" />
                  <span>Répondre à tous</span>
                  <DropdownMenuShortcut>⇧R</DropdownMenuShortcut>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem onClick={actions.forward}>
                <Forward className="size-4 mr-2" />
                <span>Transférer</span>
                <DropdownMenuShortcut>F</DropdownMenuShortcut>
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />

          {/* Mettre en sommeil (uniquement hors brouillons) */}
          {!isDraft && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Clock className="size-4 mr-2" />
                <span>Mettre en sommeil</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52">
                {isSnoozed && (
                  <>
                    <DropdownMenuItem onClick={() => actions.applySnooze(null)}>
                      <RotateCcw className="size-4 mr-2 text-primary" />
                      <span>Réveiller maintenant</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {snoozePresets.map((preset) => (
                  <DropdownMenuItem
                    key={preset.id}
                    onClick={() => actions.applySnooze(preset.getDate())}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-medium">{preset.label}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {preset.timeLabel}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          {/* Déplacer vers */}
          {availableFolders.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInput className="size-4 mr-2" />
                <span>Déplacer vers</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48 max-h-56 overflow-y-auto">
                {availableFolders.map((f) => (
                  <DropdownMenuItem key={f.path} onClick={() => actions.moveTo(f.path)}>
                    <span className="truncate">{f.name || f.path}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          {/* Étiquettes */}
          {tagsData?.data && tagsData.data.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <TagIcon className="size-4 mr-2" />
                <span>Étiquettes</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48 max-h-56 overflow-y-auto">
                {tagsData.data.map((t) => {
                  const isChecked = message.tags?.includes(t.name) ?? false;
                  return (
                    <DropdownMenuCheckboxItem
                      key={t.id}
                      checked={isChecked}
                      onClick={() => actions.toggleTag(t.name)}
                    >
                      <span
                        className="size-2 rounded-full mr-2 shrink-0"
                        style={{ backgroundColor: t.color }}
                      />
                      <span className="truncate">{t.name}</span>
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          <DropdownMenuSeparator />

          {/* Spam (hors brouillons) & Export */}
          {!isDraft && (
            <DropdownMenuItem onClick={actions.markJunkMsg}>
              <Ban className="size-4 mr-2" />
              <span>Signaler comme indésirable</span>
              <DropdownMenuShortcut>!</DropdownMenuShortcut>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={actions.print}>
            <Printer className="size-4 mr-2" />
            <span>Imprimer</span>
            <DropdownMenuShortcut>P</DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={actions.downloadEml}>
            <Download className="size-4 mr-2" />
            <span>Télécharger (.eml)</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
