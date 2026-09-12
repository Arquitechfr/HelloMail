"use client";

import { useMemo } from "react";
import { cn, formatRelativeDate } from "@/lib/utils";
import type { Message } from "@/lib/api-types";
import { EmailAvatar } from "./EmailAvatar";
import { Paperclip, Star, Pin, Check } from "lucide-react";

interface ThreadChildItemProps {
  accountId: string;
  folder: string;
  message: Message;
  isSelected: boolean;
  onSelect: () => void;
  isCompact?: boolean;
}

export function ThreadChildItem({
  folder,
  message,
  isSelected,
  onSelect,
  isCompact = false,
}: ThreadChildItemProps) {
  const isUnread = !message.flags.seen;
  const isFlagged = message.flags.flagged;
  const isPinned = Boolean(message.isPinned);
  const isFromCurrentFolder = message.folder.toUpperCase() === folder.toUpperCase();

  // Libellé de dossier explicite pour éviter toute confusion entre Envoyé et Inbox
  const folderBadge = useMemo(() => {
    if (isFromCurrentFolder) return null;
    const fUpper = message.folder.toUpperCase();
    if (fUpper === "SENT" || fUpper.includes("ENVOY")) {
      return { label: "Envoyé", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" };
    }
    if (fUpper === "DRAFTS" || fUpper.includes("BROUILLON")) {
      return { label: "Brouillon", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" };
    }
    if (fUpper === "ARCHIVE" || fUpper.includes("ARCHIV")) {
      return { label: "Archive", className: "bg-muted text-muted-foreground border-border" };
    }
    return { label: message.folder, className: "bg-muted text-muted-foreground border-border" };
  }, [message.folder, isFromCurrentFolder]);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={cn(
        "group relative flex items-center justify-between gap-2.5 py-1.5 px-3 rounded-md text-xs cursor-pointer transition-colors border-l-2 ml-4 mb-0.5",
        isSelected
          ? "bg-accent text-accent-foreground border-l-primary font-medium shadow-2xs"
          : "hover:bg-muted/40 border-l-border/60 text-muted-foreground hover:text-foreground",
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Avatar miniature */}
        <EmailAvatar
          email={message.from.address}
          name={message.from.name}
          className="size-5 shrink-0"
          fallbackClassName="text-[9px]"
        />

        {/* Expéditeur & badge dossier */}
        <div className="min-w-0 flex-1 flex items-center gap-1.5">
          <span
            className={cn(
              "truncate",
              isUnread ? "font-bold text-foreground" : "font-medium",
            )}
          >
            {message.from.name || message.from.address}
          </span>

          {folderBadge && (
            <span
              className={cn(
                "text-[9px] px-1 py-0.2 rounded border font-mono uppercase tracking-wider shrink-0",
                folderBadge.className,
              )}
              title={`Message situé dans le dossier ${message.folder}`}
            >
              {folderBadge.label}
            </span>
          )}
        </div>
      </div>

      {/* Date & indicateurs d'état */}
      <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono text-muted-foreground">
        {isPinned && <Pin className="size-2.5 fill-primary text-primary" />}
        {isFlagged && <Star className="size-2.5 fill-amber-400 text-amber-400" />}
        {message.hasAttachments && <Paperclip className="size-2.5" />}
        {isUnread && <span className="size-1.5 rounded-full bg-primary" />}
        <span>{formatRelativeDate(message.date)}</span>
        {isSelected && <Check className="size-3 text-primary stroke-[2.5]" />}
      </div>
    </div>
  );
}
