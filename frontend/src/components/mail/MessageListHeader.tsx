"use client";

import { useState } from "react";
import { Tag as TagIcon, X, Loader2, Trash2 } from "lucide-react";
import { SearchBar } from "./SearchBar";
import { DensitySelector } from "./DensitySelector";
import { isPurgeableFolder, isTrashFolder } from "@/lib/folder-utils";
import { EmptyFolderDialog } from "./folders/EmptyFolderDialog";

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
  const [emptyDialogOpen, setEmptyDialogOpen] = useState(false);
  const isPurgeable = isPurgeableFolder(folder);
  const isTrash = isTrashFolder(folder);
  const showEmptyButton = isPurgeable && !tag && !searching && total > 0;

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
              {searching ? "Recherche" : folder === "__snoozed__" ? "En sommeil" : folder === "__reminders__" ? "À relancer" : folder}
            </h2>
          )}
          <span className="rounded-full bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground border border-border/60 shrink-0">
            {total}
          </span>
          {showEmptyButton && (
            <button
              type="button"
              onClick={() => setEmptyDialogOpen(true)}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-destructive hover:bg-destructive/10 border border-destructive/25 transition-colors cursor-pointer shrink-0"
              title={isTrash ? "Vider la corbeille" : "Vider le dossier"}
            >
              <Trash2 className="size-3" />
              <span>{isTrash ? "Vider" : "Vider"}</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isFetching && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
              <Loader2 className="size-3 animate-spin text-primary" />
              <span>sync…</span>
            </span>
          )}
          <DensitySelector />
        </div>
      </div>
      <div className="px-3 pb-2.5">
        <SearchBar accountId={accountId} onResults={onResults} />
      </div>

      {showEmptyButton && (
        <EmptyFolderDialog
          open={emptyDialogOpen}
          onOpenChange={setEmptyDialogOpen}
          accountId={accountId}
          folderPath={folder}
          folderName={isTrash ? "la Corbeille" : "les Courriers indésirables"}
          messageCount={total}
        />
      )}
    </div>
  );
}

