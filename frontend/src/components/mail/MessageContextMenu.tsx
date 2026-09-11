"use client";

import React from "react";
import type { Message } from "@/lib/api-types";
import { useMessageActions } from "@/lib/hooks/useMessageActions";
import { useFolders } from "@/lib/queries/folders";
import { useTags } from "@/lib/queries/tags";
import { getSnoozePresets } from "@/lib/types/snooze";
import { isDraftFolder } from "@/lib/folder-utils";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuCheckboxItem,
} from "@/components/ui/context-menu";
import {
  Mail,
  MailOpen,
  Star,
  Archive,
  Trash2,
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

interface MessageContextMenuProps {
  accountId: string;
  folder: string;
  message: Message;
  children: React.ReactNode;
}

export function MessageContextMenu({
  accountId,
  folder,
  message,
  children,
}: MessageContextMenuProps) {
  const actions = useMessageActions({ accountId, folder, message });
  const { data: folders } = useFolders(accountId);
  const { data: tagsData } = useTags();
  const isDraft = isDraftFolder(folder, folders);

  const isUnread = !message.flags.seen;
  const isFlagged = message.flags.flagged;
  const isSnoozed = !!message.snoozedUntil;
  const hasMultipleRecipients = (message.to?.length ?? 0) > 1;

  const availableFolders = (folders ?? []).filter((f) => f.path !== folder);
  const snoozePresets = getSnoozePresets();

  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>

      <ContextMenuContent className="w-60">
        {/* Groupe 1 : Rédaction / Réponse */}
        {isDraft ? (
          <ContextMenuItem onClick={actions.editDraft}>
            <Pencil className="size-4 mr-2" />
            <span>Modifier le brouillon</span>
            <ContextMenuShortcut>E</ContextMenuShortcut>
          </ContextMenuItem>
        ) : (
          <>
            <ContextMenuItem onClick={actions.reply}>
              <Reply className="size-4 mr-2" />
              <span>Répondre</span>
              <ContextMenuShortcut>R</ContextMenuShortcut>
            </ContextMenuItem>

            {hasMultipleRecipients && (
              <ContextMenuItem onClick={actions.replyAll}>
                <ReplyAll className="size-4 mr-2" />
                <span>Répondre à tous</span>
                <ContextMenuShortcut>⇧R</ContextMenuShortcut>
              </ContextMenuItem>
            )}

            <ContextMenuItem onClick={actions.forward}>
              <Forward className="size-4 mr-2" />
              <span>Transférer</span>
              <ContextMenuShortcut>F</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}

        <ContextMenuSeparator />

        {/* Groupe 2 : Statut & Tri */}
        <ContextMenuItem onClick={actions.toggleSeen}>
          {isUnread ? (
            <>
              <MailOpen className="size-4 mr-2" />
              <span>Marquer comme lu</span>
            </>
          ) : (
            <>
              <Mail className="size-4 mr-2" />
              <span>Marquer comme non lu</span>
            </>
          )}
          <ContextMenuShortcut>U</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem onClick={actions.toggleFlagged}>
          <Star
            className={
              isFlagged
                ? "size-4 mr-2 fill-amber-400 text-amber-400"
                : "size-4 mr-2"
            }
          />
          <span>
            {isFlagged ? "Retirer l'étoile" : "Marquer comme important"}
          </span>
          <ContextMenuShortcut>S</ContextMenuShortcut>
        </ContextMenuItem>

        {/* Actions réservées aux messages reçus/archivés */}
        {!isDraft && (
          <>
            {/* Mettre en sommeil */}
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <Clock className="size-4 mr-2" />
                <span>Mettre en sommeil</span>
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-56">
                {isSnoozed && (
                  <>
                    <ContextMenuItem onClick={() => actions.applySnooze(null)}>
                      <RotateCcw className="size-4 mr-2 text-primary" />
                      <span>Réveiller maintenant</span>
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                  </>
                )}
                {snoozePresets.map((preset) => (
                  <ContextMenuItem
                    key={preset.id}
                    onClick={() => actions.applySnooze(preset.getDate())}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-medium">{preset.label}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {preset.timeLabel}
                      </span>
                    </div>
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuItem onClick={actions.archiveMessage}>
              <Archive className="size-4 mr-2" />
              <span>Archiver</span>
              <ContextMenuShortcut>E</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem onClick={actions.markJunkMsg}>
              <Ban className="size-4 mr-2" />
              <span>Signaler comme indésirable</span>
              <ContextMenuShortcut>!</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}

        <ContextMenuItem
          variant="destructive"
          onClick={() => actions.deleteMsg(false)}
        >
          <Trash2 className="size-4 mr-2" />
          <span>{isDraft ? "Supprimer le brouillon" : "Supprimer"}</span>
          <ContextMenuShortcut>Suppr</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Groupe 3 : Organisation & Dossiers */}
        {availableFolders.length > 0 && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <FolderInput className="size-4 mr-2" />
              <span>Déplacer vers</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-52 max-h-56 overflow-y-auto">
              {availableFolders.map((f) => (
                <ContextMenuItem
                  key={f.path}
                  onClick={() => actions.moveTo(f.path)}
                >
                  <span className="truncate">{f.name || f.path}</span>
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        {/* Étiquettes */}
        {tagsData?.data && tagsData.data.length > 0 && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <TagIcon className="size-4 mr-2" />
              <span>Étiquettes</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-52 max-h-56 overflow-y-auto">
              {tagsData.data.map((t) => {
                const isChecked = message.tags?.includes(t.name) ?? false;
                return (
                  <ContextMenuCheckboxItem
                    key={t.id}
                    checked={isChecked}
                    onClick={() => actions.toggleTag(t.name)}
                  >
                    <span
                      className="size-2 rounded-full mr-2 shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    <span className="truncate">{t.name}</span>
                  </ContextMenuCheckboxItem>
                );
              })}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        <ContextMenuSeparator />

        {/* Groupe 4 : Export & Outils */}
        <ContextMenuItem onClick={actions.print}>
          <Printer className="size-4 mr-2" />
          <span>Imprimer</span>
          <ContextMenuShortcut>P</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem onClick={actions.downloadEml}>
          <Download className="size-4 mr-2" />
          <span>Télécharger (.eml)</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
