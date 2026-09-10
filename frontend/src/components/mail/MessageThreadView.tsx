"use client";

import { useState } from "react";
import type { ThreadResponse } from "@/lib/api-types";
import { formatDate, cn } from "@/lib/utils";
import { MessageSquare, ChevronDown, ChevronUp, Paperclip, Check } from "lucide-react";

interface MessageThreadViewProps {
  thread?: ThreadResponse;
  currentUid: number;
  onSelectMessage: (folder: string, uid: number) => void;
}

export function MessageThreadView({
  thread,
  currentUid,
  onSelectMessage,
}: MessageThreadViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!thread || thread.count <= 1) {
    return null;
  }

  return (
    <div className="border-b border-border bg-muted/20 px-4 py-2 no-print select-none">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex items-center gap-2 text-xs font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
        >
          <span className="flex items-center justify-center size-5 rounded-md bg-primary/10 text-primary">
            <MessageSquare className="size-3.5" />
          </span>
          <span>
            Conversation · {thread.count} messages
          </span>
          {isExpanded ? (
            <ChevronUp className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          )}
        </button>

        {/* Aperçu rapide des participants */}
        <div className="flex items-center gap-1 overflow-x-auto text-[11px] text-muted-foreground">
          {thread.messages.map((m, idx) => {
            const isCurrent = m.uid === currentUid;
            return (
              <button
                key={`${m.folder}-${m.uid}-${idx}`}
                type="button"
                onClick={() => onSelectMessage(m.folder, m.uid)}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer truncate max-w-[130px]",
                  isCurrent
                    ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                    : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground",
                )}
                title={`${m.from.name || m.from.address} (${formatDate(m.date)})`}
              >
                {m.from.name || m.from.address.split("@")[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Vue accordéon dépliée */}
      {isExpanded && (
        <div className="mt-2.5 space-y-1.5 pt-2 border-t border-border/60 animate-in fade-in-50 duration-150">
          {thread.messages.map((item, idx) => {
            const isCurrent = item.uid === currentUid;
            const senderLabel = item.from.name
              ? `${item.from.name} <${item.from.address}>`
              : item.from.address;

            return (
              <div
                key={`thread-item-${item.folder}-${item.uid}-${idx}`}
                onClick={() => onSelectMessage(item.folder, item.uid)}
                className={cn(
                  "flex items-center justify-between p-2 rounded-md text-xs cursor-pointer transition-colors",
                  isCurrent
                    ? "bg-card border border-primary/30 shadow-2xs"
                    : "hover:bg-muted/40 border border-transparent",
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={cn(
                      "size-2 rounded-full shrink-0",
                      isCurrent ? "bg-primary" : item.flags.seen ? "bg-muted-foreground/30" : "bg-blue-500",
                    )}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-medium truncate">
                      <span className={cn(isCurrent ? "text-primary font-semibold" : "text-foreground")}>
                        {senderLabel}
                      </span>
                      {item.folder !== "INBOX" && (
                        <span className="text-[10px] px-1 py-0.2 rounded bg-muted text-muted-foreground uppercase font-mono">
                          {item.folder}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {item.subject || "(Sans objet)"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 text-muted-foreground text-[11px]">
                  {item.hasAttachments && <Paperclip className="size-3 text-muted-foreground" />}
                  <span className="font-mono">{formatDate(item.date)}</span>
                  {isCurrent && <Check className="size-3.5 text-primary" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
