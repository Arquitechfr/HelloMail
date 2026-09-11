"use client";

import { useRef, useMemo, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useUnifiedMessages } from "@/lib/queries/unified";
import { useAccounts } from "@/lib/queries/accounts";
import { useUIStore } from "@/lib/stores/uiStore";
import { MessageListItem } from "@/components/mail/MessageListItem";
import { QuickFilterBar, type QuickFilter } from "@/components/mail/QuickFilterBar";
import { UnifiedBatchActionBar } from "./UnifiedBatchActionBar";
import { UNIFIED_FOLDER_DEFINITIONS } from "@/lib/unified-utils";
import type { UnifiedFolderType, Message } from "@/lib/api-types";
import { Loader2, Inbox, Tag as TagIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UnifiedMessageListProps {
  type: UnifiedFolderType;
  selectedMessage: { accountId: string; folder: string; uid: number } | null;
  onSelectMessage: (msg: Message & { accountId: string; folder: string }) => void;
}

export function UnifiedMessageList({
  type,
  selectedMessage,
  onSelectMessage,
}: UnifiedMessageListProps) {
  const selectedTag = useUIStore((s) => s.selectedTag);
  const setSelectedTag = useUIStore((s) => s.setSelectedTag);
  const selectAllUids = useUIStore((s) => s.selectAllUids);

  const { data: accounts } = useAccounts();
  const accountMap = useMemo(() => {
    const map: Record<string, { color?: string; emailAddress: string }> = {};
    accounts?.forEach((acc) => {
      map[acc._id] = { color: acc.color, emailAddress: acc.emailAddress };
    });
    return map;
  }, [accounts]);

  const { data, isLoading, isFetching } = useUnifiedMessages(
    type,
    1,
    100,
    selectedTag,
  );

  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

  const messages = data?.data ?? [];

  const filteredMessages = useMemo(() => {
    switch (quickFilter) {
      case "unread":
        return messages.filter((m) => !m.flags.seen);
      case "pinned":
        return messages.filter((m) => m.isPinned);
      case "attachments":
        return messages.filter((m) => m.hasAttachments);
      default:
        return messages;
    }
  }, [messages, quickFilter]);

  const filterCounts = useMemo(() => ({
    all: messages.length,
    unread: messages.filter((m) => !m.flags.seen).length,
    pinned: messages.filter((m) => m.isPinned).length,
    attachments: messages.filter((m) => m.hasAttachments).length,
  }), [messages]);

  const meta = UNIFIED_FOLDER_DEFINITIONS[type];
  const Icon = meta?.icon ?? Inbox;
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: filteredMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  const handleSelectAll = () => {
    selectAllUids(filteredMessages.map((m) => m.uid));
  };

  return (
    <div className="relative flex h-full w-full md:w-80 lg:w-96 flex-col border-r border-border bg-background select-none shrink-0 overflow-hidden">
      {/* En-tête de la liste unifiée */}
      <div className="shrink-0 border-b border-border bg-background/60 backdrop-blur-xs px-3.5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="size-4 text-primary shrink-0" />
            <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider font-display truncate">
              {meta?.defaultLabel ?? type}
            </h2>
            <span className="rounded-full bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground border border-border/60 shrink-0">
              {data?.total ?? messages.length}
            </span>
          </div>
          {isFetching && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0 ml-2">
              <Loader2 className="size-3 animate-spin text-primary" />
              <span>sync…</span>
            </span>
          )}
        </div>

        {/* Filtre par étiquette active */}
        {selectedTag && (
          <div className="mt-2 flex items-center justify-between rounded-md bg-accent/50 px-2 py-1 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <TagIcon className="size-3 text-primary shrink-0" />
              <span className="truncate font-medium text-foreground">
                {selectedTag}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
              title="Effacer le filtre"
            >
              <X className="size-3" />
            </button>
          </div>
        )}
      </div>

      {/* Barre de filtres rapides */}
      <QuickFilterBar
        currentFilter={quickFilter}
        onFilterChange={setQuickFilter}
        counts={filterCounts}
        className="border-b border-border/40 bg-muted/20"
      />

      {/* Contenu : liste des messages ou état vide */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-muted-foreground">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted/60 mb-3 border border-border/60">
            <Icon className="size-5 text-muted-foreground" />
          </div>
          <p className="text-xs font-medium text-foreground">Aucun email unifié</p>
          <p className="text-[11px] text-muted-foreground mt-1 max-w-xs">
            Aucun message correspondant dans tous vos comptes synchronisés.
          </p>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-muted-foreground">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted/60 mb-3 border border-border/60">
            <Icon className="size-5 text-muted-foreground" />
          </div>
          <p className="text-xs font-medium text-foreground">Aucun message pour ce filtre</p>
          <p className="text-[11px] text-muted-foreground mt-1 max-w-xs">
            Modifiez ou désactivez le filtre actif pour voir tous vos emails.
          </p>
        </div>
      ) : (
        <div ref={parentRef} className="flex-1 overflow-y-auto">
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((item) => {
              const msg = filteredMessages[item.index] as Message & {
                accountId: string;
                folder: string;
              };
              const isSelected =
                selectedMessage?.accountId === msg.accountId &&
                selectedMessage?.folder === msg.folder &&
                selectedMessage?.uid === msg.uid;

              return (
                <div
                  key={`${msg.accountId}-${msg.folder}-${msg.uid}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  <MessageListItem
                    accountId={msg.accountId}
                    folder={msg.folder}
                    message={msg}
                    isSelected={isSelected}
                    accountColor={accountMap[msg.accountId]?.color}
                    onSelect={() => onSelectMessage(msg)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Barre d'actions groupées unifiée */}
      <UnifiedBatchActionBar
        messages={filteredMessages as (Message & { accountId: string; folder: string })[]}
        totalSelectable={filteredMessages.length}
        onSelectAll={handleSelectAll}
      />
    </div>
  );
}
