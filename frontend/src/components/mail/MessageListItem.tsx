"use client";

import { useMemo } from "react";
import { cn, formatRelativeDate } from "@/lib/utils";
import type { Message } from "@/lib/api-types";
import { useTags } from "@/lib/queries/tags";
import { useFolders } from "@/lib/queries/folders";
import { isDraftFolder } from "@/lib/folder-utils";
import { useMessageActions } from "@/lib/hooks/useMessageActions";
import { TagBadge } from "./TagBadge";
import { EmailAvatar } from "./EmailAvatar";
import { MessageContextMenu } from "./MessageContextMenu";
import { MessageQuickActions } from "./MessageQuickActions";
import { Paperclip, Star, Clock } from "lucide-react";

interface MessageListItemProps {
  accountId: string;
  folder: string;
  message: Message;
  isSelected: boolean;
  onSelect: () => void;
}

export function MessageListItem({
  accountId,
  folder,
  message,
  isSelected,
  onSelect,
}: MessageListItemProps) {
  const isUnread = !message.flags.seen;
  const isFlagged = message.flags.flagged;
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

  const handleDoubleClick = () => {
    if (isDraft) {
      actions.editDraft();
    }
  };

  return (
    <MessageContextMenu accountId={accountId} folder={folder} message={message}>
      <div
        className={cn(
          "group relative flex cursor-pointer items-start gap-2.5 px-3.5 py-2.5 transition-colors border-b border-border/40 select-none",
          isSelected
            ? "bg-accent/80 text-accent-foreground border-l-2 border-l-primary"
            : "hover:bg-muted/40 border-l-2 border-l-transparent",
        )}
        onClick={onSelect}
        onDoubleClick={handleDoubleClick}
      >
        {/* Avatar / logo / initiales */}
        <EmailAvatar
          email={message.from.address}
          name={message.from.name}
          className="size-7 mt-0.5"
          fallbackClassName="text-[11px]"
        />

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
