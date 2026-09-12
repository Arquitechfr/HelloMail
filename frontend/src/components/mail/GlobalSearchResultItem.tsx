"use client";

import type { Message } from "@/lib/api-types";
import { Folder, Star, Paperclip, Tag } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface GlobalSearchResultItemProps {
  message: Message;
  isSelected: boolean;
  onSelect: (message: Message) => void;
}

export function GlobalSearchResultItem({
  message,
  isSelected,
  onSelect,
}: GlobalSearchResultItemProps) {
  const isUnread = !message.flags.seen;
  const senderName = message.from?.name || message.from?.address || "Inconnu";

  return (
    <button
      type="button"
      onClick={() => onSelect(message)}
      className={`flex items-start justify-between gap-3 w-full text-left rounded-lg p-2.5 transition-colors cursor-pointer ${
        isSelected
          ? "bg-accent text-accent-foreground"
          : "hover:bg-muted/50 text-foreground"
      }`}
    >
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {message.accountColor && (
            <span
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: message.accountColor }}
              title={message.accountEmail || "Compte"}
            />
          )}
          <span
            className={`text-xs truncate ${
              isUnread ? "font-bold text-foreground" : "text-muted-foreground"
            }`}
          >
            {senderName}
          </span>
          <span className="inline-flex items-center rounded border border-border bg-muted/50 px-1.5 py-0 text-[10px] text-muted-foreground h-4 shrink-0">
            <Folder className="size-2.5 mr-0.5" />
            {message.folder}
          </span>
          {message.flags.flagged && (
            <Star className="size-3 fill-amber-400 text-amber-400 shrink-0" />
          )}
          {message.hasAttachments && (
            <Paperclip className="size-3 text-muted-foreground shrink-0" />
          )}
          {message.tags && message.tags.length > 0 && (
            <Tag className="size-2.5 text-primary shrink-0" />
          )}
        </div>
        <p
          className={`text-xs truncate ${
            isUnread ? "font-semibold text-foreground" : "text-muted-foreground"
          }`}
        >
          {message.subject || "(Sans objet)"}
        </p>
      </div>
      <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap pt-0.5">
        {message.date ? formatDate(message.date) : ""}
      </span>
    </button>
  );
}
