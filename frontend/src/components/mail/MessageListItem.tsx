"use client";

import { cn, formatRelativeDate, getInitials } from "@/lib/utils";
import type { Message } from "@/lib/api-types";
import { Paperclip, Star } from "lucide-react";

interface MessageListItemProps {
  message: Message;
  isSelected: boolean;
  onSelect: () => void;
}

export function MessageListItem({ message, isSelected, onSelect }: MessageListItemProps) {
  const isUnread = !message.flags.seen;
  const isFlagged = message.flags.flagged;

  return (
    <div
      className={cn(
        "group relative flex cursor-pointer items-start gap-2.5 px-3.5 py-2.5 transition-colors border-b border-border/40 select-none",
        isSelected
          ? "bg-accent/80 text-accent-foreground border-l-2 border-l-primary"
          : "hover:bg-muted/40 border-l-2 border-l-transparent",
      )}
      onClick={onSelect}
    >
      {/* Avatar / initiales */}
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary mt-0.5">
        {getInitials(message.from.name, message.from.address)}
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
          <span className="shrink-0 text-[11px] text-muted-foreground font-mono">
            {formatRelativeDate(message.date)}
          </span>
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
      </div>
    </div>
  );
}
