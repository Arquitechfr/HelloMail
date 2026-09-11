"use client";

import { Tag as TagIcon, X, Loader2 } from "lucide-react";
import { SearchBar } from "./SearchBar";

interface MessageListHeaderProps {
  folder: string;
  tag?: string | null;
  onClearTag?: () => void;
  total: number;
  isFetching: boolean;
  accountId: string;
  onResults: (results: unknown[] | null) => void;
  searching?: boolean;
}

export function MessageListHeader({
  folder,
  tag,
  onClearTag,
  total,
  isFetching,
  accountId,
  onResults,
  searching,
}: MessageListHeaderProps) {
  return (
    <div className="shrink-0 border-b border-border bg-background/60 backdrop-blur-xs">
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {tag ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <TagIcon className="size-3.5 text-primary shrink-0" />
              <span className="text-xs font-semibold text-foreground truncate font-display">
                {tag}
              </span>
              {onClearTag && (
                <button
                  type="button"
                  onClick={onClearTag}
                  className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                  title="Effacer le filtre par étiquette"
                  aria-label="Effacer le filtre par étiquette"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          ) : (
            <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider font-display truncate">
              {searching ? "Recherche" : folder === "__snoozed__" ? "En sommeil" : folder}
            </h2>
          )}
          <span className="rounded-full bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground border border-border/60 shrink-0">
            {total}
          </span>
        </div>
        {isFetching && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0 ml-2">
            <Loader2 className="size-3 animate-spin text-primary" />
            <span>sync…</span>
          </span>
        )}
      </div>
      <div className="px-3 pb-2.5">
        <SearchBar accountId={accountId} onResults={onResults} />
      </div>
    </div>
  );
}
