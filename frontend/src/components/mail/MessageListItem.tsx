"use client";

import { useMemo, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn, formatRelativeDate } from "@/lib/utils";
import type { Message } from "@/lib/api-types";
import { useTags } from "@/lib/queries/tags";
import { useFolders } from "@/lib/queries/folders";
import { messageKeys, fetchMessageDetail } from "@/lib/queries/messages";
import { isDraftFolder } from "@/lib/folder-utils";
import { useMessageActions } from "@/lib/hooks/useMessageActions";
import { TagBadge } from "./TagBadge";
import { EmailAvatar } from "./EmailAvatar";
import { MessageContextMenu } from "./MessageContextMenu";
import { MessageQuickActions } from "./MessageQuickActions";
import { useUIStore } from "@/lib/stores/uiStore";
import { Paperclip, Star, Clock, Pin, Check } from "lucide-react";

interface MessageListItemProps {
  accountId: string;
  folder: string;
  message: Message;
  isSelected: boolean;
  onSelect: () => void;
  accountColor?: string;
  allVisibleUids?: number[];
}

export function MessageListItem({
  accountId,
  folder,
  message,
  isSelected,
  onSelect,
  accountColor,
  allVisibleUids,
}: MessageListItemProps) {
  const isUnread = !message.flags.seen;
  const isFlagged = message.flags.flagged;
  const isPinned = Boolean(message.isPinned);
  const selectedUids = useUIStore((s) => s.selectedUids);
  const toggleSelectUid = useUIStore((s) => s.toggleSelectUid);
  const selectRangeUids = useUIStore((s) => s.selectRangeUids);
  const isBatchSelected = selectedUids.includes(message.uid);
  const hasBatchSelection = selectedUids.length > 0;

  const { data: tagsData } = useTags();
  const { data: folders } = useFolders(accountId);
  const isDraft = isDraftFolder(folder, folders);
  const actions = useMessageActions({ accountId, folder, message });

  const tagColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    tagsData?.data?.forEach((t) => {
      map[t.name] = t.color;
    });
    return map;
  }, [tagsData]);

  const queryClient = useQueryClient();
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
    }
    prefetchTimerRef.current = setTimeout(() => {
      queryClient.prefetchQuery({
        queryKey: messageKeys.detail(accountId, folder, message.uid),
        queryFn: () => fetchMessageDetail(accountId, folder, message.uid),
        staleTime: 60_000,
      });
    }, 65);
  }, [queryClient, accountId, folder, message.uid]);

  const handleMouseLeave = useCallback(() => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (prefetchTimerRef.current) {
        clearTimeout(prefetchTimerRef.current);
      }
    };
  }, []);

  const handleDoubleClick = () => {
    if (isDraft) {
      actions.editDraft();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.shiftKey && allVisibleUids && allVisibleUids.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      selectRangeUids(allVisibleUids, message.uid);
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      toggleSelectUid(message.uid);
      return;
    }
    onSelect();
  };

  const handleSelectButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey && allVisibleUids && allVisibleUids.length > 0) {
      selectRangeUids(allVisibleUids, message.uid);
    } else {
      toggleSelectUid(message.uid);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        accountId,
        folder,
        uid: message.uid,
      }),
    );
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <MessageContextMenu accountId={accountId} folder={folder} message={message}>
      <div
        draggable={true}
        onDragStart={handleDragStart}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "group relative flex cursor-pointer items-start gap-2.5 px-3.5 py-2.5 transition-colors border-b border-border/40 select-none cursor-grab active:cursor-grabbing",
          isBatchSelected
            ? "bg-primary/10 text-foreground border-l-2 border-l-primary"
            : isSelected
              ? "bg-accent/80 text-accent-foreground border-l-2 border-l-primary"
              : isPinned
                ? "bg-primary/[0.04] hover:bg-primary/[0.07] border-l-2 border-l-primary/70"
                : "hover:bg-muted/40 border-l-2 border-l-transparent",
        )}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* Avatar / logo / initiales + bouton de sélection multiple */}
        <div className="relative shrink-0 mt-0.5">
          <EmailAvatar
            email={message.from.address}
            name={message.from.name}
            className="size-7"
            fallbackClassName="text-[11px]"
          />
          {accountColor && (
            <span
              className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-1.5 ring-background"
              style={{ backgroundColor: accountColor }}
              title="Compte associé"
            />
          )}

          {/* Bouton de sélection multiple au survol ou actif */}
          <button
            type="button"
            onClick={handleSelectButtonClick}
            className={cn(
              "absolute inset-0 z-10 flex items-center justify-center rounded-full border transition-all cursor-pointer",
              isBatchSelected
                ? "opacity-100 border-primary bg-primary text-primary-foreground shadow-2xs"
                : hasBatchSelection
                  ? "opacity-100 border-border bg-card hover:border-primary/60 text-muted-foreground"
                  : "opacity-0 group-hover:opacity-100 border-border bg-card/95 hover:border-primary/60 text-muted-foreground",
            )}
            title={isBatchSelected ? "Désélectionner" : "Sélectionner"}
            aria-label={isBatchSelected ? "Désélectionner le message" : "Sélectionner le message"}
          >
            {isBatchSelected ? (
              <Check className="size-3.5 stroke-[3]" />
            ) : (
              <div className="size-2 rounded-full border border-muted-foreground/50" />
            )}
          </button>
        </div>

        {/* Contenu */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "truncate text-xs",
                isUnread ? "font-bold text-foreground" : "font-medium text-foreground/80",
              )}
            >
              {message.from.name ?? message.from.address}
            </span>
            <div className="flex items-center shrink-0">
              <span className="text-[11px] text-muted-foreground font-mono group-hover:hidden">
                {formatRelativeDate(message.date)}
              </span>
              <div className="hidden group-hover:flex items-center">
                <MessageQuickActions
                  accountId={accountId}
                  folder={folder}
                  message={message}
                />
              </div>
            </div>
          </div>

        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "truncate text-xs",
              isUnread ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {message.subject || "(Sans objet)"}
          </span>

          <div className="flex shrink-0 items-center gap-1.5 ml-1">
            {isPinned && <Pin className="size-3 fill-primary text-primary" />}
            {isFlagged && <Star className="size-3 fill-amber-400 text-amber-400" />}
            {message.hasAttachments && <Paperclip className="size-3 text-muted-foreground" />}
            {isUnread && <span className="size-1.5 rounded-full bg-primary" />}
          </div>
        </div>

        {(message.tags && message.tags.length > 0 || message.snoozedUntil) && (
          <div className="flex items-center gap-1 flex-wrap mt-0.5">
            {message.snoozedUntil && (
              <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0">
                <Clock className="size-2.5" />
                <span>Réveil {formatRelativeDate(message.snoozedUntil)}</span>
              </span>
            )}
            {message.tags?.slice(0, 2).map((tag) => (
              <TagBadge
                key={tag}
                name={tag}
                color={tagColorMap[tag] || "#3b82f6"}
                size="sm"
              />
            ))}
            {message.tags && message.tags.length > 2 && (
              <span className="text-[10px] text-muted-foreground font-medium">
                +{message.tags.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  </MessageContextMenu>
);
}
