"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface SmartRepliesChipsProps {
  replies: string[];
  onSelectReply: (reply: string) => void;
  className?: string;
}

export function SmartRepliesChips({
  replies,
  onSelectReply,
  className,
}: SmartRepliesChipsProps) {
  if (!replies || replies.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 overflow-x-auto py-1.5 no-scrollbar select-none",
        className,
      )}
      role="group"
      aria-label="Réponses suggérées"
    >
      <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground shrink-0 pl-1 pr-1">
        <Sparkles className="size-3 text-primary" />
        <span className="hidden sm:inline">Suggestions :</span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {replies.map((reply) => (
          <button
            key={reply}
            type="button"
            onClick={() => onSelectReply(reply)}
            className="inline-flex items-center text-xs px-3 py-1 rounded-full border border-primary/20 bg-primary/5 hover:bg-primary/15 hover:border-primary/40 text-foreground font-medium transition-colors cursor-pointer active:scale-98"
          >
            {reply}
          </button>
        ))}
      </div>
    </div>
  );
}
