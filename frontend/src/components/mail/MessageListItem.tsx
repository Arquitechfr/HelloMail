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
        "flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors",
        isSelected ? "bg-primary/15" : "hover:bg-muted/40",
        isUnread && "font-medium",
      )}
      onClick={onSelect}
    >
      {/* Avatar / initiales */}
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
        {getInitials(message.from.name, message.from.address)}
      </div>

      {/* Contenu */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("truncate text-sm", isUnread ? "font-semibold" : "font-normal")}>
            {message.from.name ?? message.from.address}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatRelativeDate(message.date)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("truncate text-sm", isUnread ? "text-foreground" : "text-muted-foreground")}>
            {message.subject || "(Sans objet)"}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {isFlagged && <Star className="size-3.5 fill-amber-400 text-amber-400" />}
            {message.hasAttachments && <Paperclip className="size-3.5 text-muted-foreground" />}
          </div>
        </div>
      </div>

      {/* Indicateur non lu */}
      {isUnread && <div className="size-2 shrink-0 rounded-full bg-primary" />}
    </div>
  );
}
