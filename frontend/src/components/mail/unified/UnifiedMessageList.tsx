"use client";

import { useRef, useMemo, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useUnifiedMessages } from "@/lib/queries/unified";
import { useAccounts } from "@/lib/queries/accounts";
import { useUIStore } from "@/lib/stores/uiStore";
import { MessageListItem } from "@/components/mail/MessageListItem";
import { QuickFilterBar } from "@/components/mail/QuickFilterBar";
import { filterMessages, computeFilterCounts } from "@/lib/quick-filters";
import { useListNavigationShortcuts } from "@/lib/hooks/useListNavigationShortcuts";
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
  const quickFilter = useUIStore((s) => s.quickFilter);
  const setQuickFilter = useUIStore((s) => s.setQuickFilter);

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

  const messages = data?.data ?? [];

  const filteredMessages = useMemo(() => filterMessages(messages, quickFilter), [messages, quickFilter]);
  const filterCounts = useMemo(() => computeFilterCounts(messages), [messages]);

  const meta = UNIFIED_FOLDER_DEFINITIONS[type];
  const Icon = meta?.icon ?? Inbox;
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: filteredMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  const handleSelectUid = (uid: number | null) => {
    if (uid === null) {
      useUIStore.getState().setSelectedUid(null);
    } else {
      const targetMsg = filteredMessages.find((m) => m.uid === uid) as
        | (Message & { accountId: string; folder: string })
        | undefined;
      if (targetMsg) {
        onSelectMessage(targetMsg);
      }
    }
  };

  const { visibleUids, handleSelectAll } = useListNavigationShortcuts({
    items: filteredMessages,
    selectedUid: selectedMessage?.uid ?? null,
    onSelectUid: handleSelectUid,
  });

  return (
    <div
      className={cn(
        "relative flex flex-1 md:flex-initial md:w-84 lg:w-96 flex-col border-r border-border bg-card/30 overflow-hidden select-none shrink-0",
        selectedMessage !== null ? "hidden md:flex" : "flex",
      )}
    >
      {/* En-tête de la liste unifiée */}
      <div className="shrink-0 border-b border-border bg-background/60 backdrop-blur-xs px-3.5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="size-4 text-primary shrink-0" />
            <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider font-display truncate">
              {meta?.defaultLabel ?? type}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            {isFetching && (
              <Loader2 className="size-3 animate-spin text-muted-foreground" />
            )}
            <span className="text-xs font-mono text-muted-foreground">
              {data?.total ?? 0}
            </span>
          </div>
        </div>

        {/* Filtre par étiquette actif */}
        {selectedTag && (
          <div className="mt-2 flex items-center justify-between gap-1.5 rounded bg-primary/10 px-2 py-1 text-xs text-primary">
            <div className="flex items-center gap-1.5 truncate">
              <TagIcon className="size-3 shrink-0" />
              <span className="truncate">Étiquette : {selectedTag}</span>
            </div>
            <button
              onClick={() => setSelectedTag(null)}
              className="rounded p-0.5 hover:bg-primary/20 transition-colors"
              title="Supprimer le filtre par étiquette"
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

      {/* Liste virtualisée */}
      {filteredMessages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground p-6 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-muted/50 border border-border">
            <Inbox className="size-4 opacity-60 text-muted-foreground" />
          </div>
          <p className="text-xs font-medium text-foreground">
            {isLoading
              ? "Chargement des messages…"
              : messages.length > 0
                ? quickFilter === "unread"
                  ? "Aucun message non lu"
                  : quickFilter === "starred"
                    ? "Aucun message important"
                    : quickFilter === "pinned"
                      ? "Aucun message épinglé"
                      : quickFilter === "attachments"
                        ? "Aucun message avec pièce jointe"
                        : "Aucun message trouvé"
                : "Aucun message"}
          </p>
          {messages.length > 0 && filteredMessages.length === 0 ? (
            <button
              type="button"
              onClick={() => setQuickFilter("all")}
              className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
            >
              Afficher tous les messages
            </button>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {isLoading
                ? "Veuillez patienter."
                : selectedTag
                  ? `Aucun message avec l'étiquette « ${selectedTag} »`
                  : "Cette boîte unifiée est vide."}
            </p>
          )}
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
                    allVisibleUids={visibleUids}
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
