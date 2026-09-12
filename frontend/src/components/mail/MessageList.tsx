"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMessages, useFetchMore } from "@/lib/queries/messages";
import { useUIStore } from "@/lib/stores/uiStore";
import { MessageListItem } from "@/components/mail/MessageListItem";
import { MessageListHeader } from "@/components/mail/MessageListHeader";
import { BatchActionBar } from "@/components/mail/BatchActionBar";
import { QuickFilterBar } from "@/components/mail/QuickFilterBar";
import { filterMessages, computeFilterCounts } from "@/lib/quick-filters";
import { groupMessagesIntoThreads } from "@/lib/threading";
import { useListNavigationShortcuts } from "@/lib/hooks/useListNavigationShortcuts";
import { Loader2, Inbox } from "lucide-react";
import type { Message } from "@/lib/api-types";
import { cn } from "@/lib/utils";

interface MessageListProps {
  accountId: string;
  folder: string;
}

export function MessageList({ accountId, folder }: MessageListProps) {
  const selectedTag = useUIStore((s) => s.selectedTag);
  const setSelectedTag = useUIStore((s) => s.setSelectedTag);
  const { data, isLoading, error, isFetching } = useMessages(accountId, folder, 1, 100, selectedTag);
  const fetchMore = useFetchMore(accountId);
  const fetchMoreMutate = fetchMore.mutate;
  const selectedUid = useUIStore((s) => s.selectedUid);
  const setSelectedUid = useUIStore((s) => s.setSelectedUid);
  const quickFilter = useUIStore((s) => s.quickFilter);
  const setQuickFilter = useUIStore((s) => s.setQuickFilter);
  const conversationViewEnabled = useUIStore((s) => s.conversationViewEnabled);
  const expandedThreadIds = useUIStore((s) => s.expandedThreadIds);
  const toggleThreadExpanded = useUIStore((s) => s.toggleThreadExpanded);

  const parentRef = useRef<HTMLDivElement>(null);
  const [searchResults, setSearchResults] = useState<Message[] | null>(null);

  const hasMoreRef = useRef(true);
  const fetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  useEffect(() => {
    hasMoreRef.current = true;
    fetchingRef.current = false;
    lastFetchTimeRef.current = 0;
  }, [folder]);

  const handleResults = useCallback((results: unknown[] | null) => {
    setSearchResults(results as Message[] | null);
  }, []);

  const messages = searchResults ?? data?.data ?? [];
  const filteredMessages = useMemo(() => filterMessages(messages, quickFilter), [messages, quickFilter]);
  const filterCounts = useMemo(() => computeFilterCounts(messages), [messages]);

  // Groupement en conversation (désactivé si recherche ou tag actif)
  const threadGroups = useMemo(() => {
    if (!conversationViewEnabled || searchResults || selectedTag) return null;
    return groupMessagesIntoThreads(filteredMessages);
  }, [conversationViewEnabled, searchResults, selectedTag, filteredMessages]);

  const displayedMessages = useMemo(() => {
    if (!threadGroups) return filteredMessages;
    return threadGroups.map((g) => g.rootMessage);
  }, [threadGroups, filteredMessages]);

  const displayDensity = useUIStore((s) => s.displayDensity);
  const estimateItemSize = useCallback(() => {
    switch (displayDensity) {
      case "compact": return 44;
      case "spacious": return 92;
      case "comfortable":
      default: return 72;
    }
  }, [displayDensity]);

  const virtualizer = useVirtualizer({
    count: displayedMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: estimateItemSize,
    overscan: 10,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [displayDensity, conversationViewEnabled, expandedThreadIds, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();
  const isNearBottom = virtualItems.length > 0 && virtualItems[virtualItems.length - 1].index >= displayedMessages.length - 5;

  useEffect(() => {
    if (isNearBottom && !searchResults && messages.length > 0 && !fetchingRef.current && hasMoreRef.current && Date.now() - lastFetchTimeRef.current >= 3000) {
      fetchingRef.current = true;
      lastFetchTimeRef.current = Date.now();
      fetchMoreMutate({ folder }, {
        onSuccess: (result) => {
          fetchingRef.current = false;
          if (result.fetched === 0) hasMoreRef.current = false;
        },
        onError: () => {
          fetchingRef.current = false;
          hasMoreRef.current = false;
        },
      });
    }
  }, [isNearBottom, searchResults, messages.length, fetchMoreMutate, folder]);

  const { visibleUids, handleSelectAll } = useListNavigationShortcuts({
    items: displayedMessages,
    selectedUid,
    onSelectUid: (uid) => {
      const target = displayedMessages.find((m) => m.uid === uid);
      setSelectedUid(uid, target?.folder ?? null);
    },
    enabled: !isLoading && !error && messages.length > 0,
  });

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex flex-1 md:flex-initial md:w-84 lg:w-96 flex-col items-center justify-center border-r border-border bg-card/30",
          selectedUid !== null ? "hidden md:flex" : "flex",
        )}
      >
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "flex flex-1 md:flex-initial md:w-84 lg:w-96 flex-col items-center justify-center gap-2 border-r border-border text-muted-foreground bg-card/30",
          selectedUid !== null ? "hidden md:flex" : "flex",
        )}
      >
        <p className="text-xs">Impossible de charger les messages</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-1 md:flex-initial md:w-84 lg:w-96 flex-col border-r border-border bg-card/30 overflow-hidden",
          selectedUid !== null ? "hidden md:flex" : "flex",
        )}
      >
        <MessageListHeader
          folder={folder}
          tag={selectedTag}
          onClearTag={() => setSelectedTag(null)}
          total={data?.total ?? 0}
          isFetching={isFetching}
          accountId={accountId}
          onResults={handleResults}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 text-muted-foreground p-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted/50 border border-border">
            <Inbox className="size-5 opacity-60 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">
              {searchResults
                ? "Aucun résultat trouvé"
                : selectedTag
                  ? `Aucun message avec l'étiquette « ${selectedTag} »`
                  : "Boîte vide"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {searchResults ? "Essayez avec d'autres mots-clés" : "Aucun message trouvé"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex flex-1 md:flex-initial md:w-84 lg:w-96 flex-col border-r border-border bg-card/30 overflow-hidden select-none",
        selectedUid !== null ? "hidden md:flex" : "flex",
      )}
    >
      <MessageListHeader
        folder={folder}
        tag={selectedTag}
        onClearTag={() => setSelectedTag(null)}
        total={data?.total ?? 0}
        isFetching={isFetching}
        accountId={accountId}
        onResults={handleResults}
        searching={!!searchResults}
      />

      {/* Barre de filtres rapides (Tous, Non lus, Épinglés, Pièces jointes) */}
      <QuickFilterBar
        currentFilter={quickFilter}
        onFilterChange={setQuickFilter}
        counts={filterCounts}
        className="border-b border-border/40 bg-muted/20"
      />

      {/* Liste virtualisée */}
      {displayedMessages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 text-muted-foreground p-6 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-muted/50 border border-border">
            <Inbox className="size-4 opacity-60 text-muted-foreground" />
          </div>
          <p className="text-xs font-medium text-foreground">
            {quickFilter === "unread"
              ? "Aucun message non lu"
              : quickFilter === "starred"
                ? "Aucun message important"
                : quickFilter === "pinned"
                  ? "Aucun message épinglé"
                  : quickFilter === "attachments"
                    ? "Aucun message avec pièce jointe"
                    : "Aucun message trouvé"}
          </p>
          <button
            type="button"
            onClick={() => setQuickFilter("all")}
            className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
          >
            Afficher tous les messages
          </button>
        </div>
      ) : (
        <div ref={parentRef} className="flex-1 overflow-y-auto">
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((item) => {
              const msg = displayedMessages[item.index];
              const group = threadGroups ? threadGroups[item.index] : null;
              const isExpanded = group ? expandedThreadIds.includes(group.threadId) : false;
              const isSelected =
                selectedUid === msg.uid ||
                (!isExpanded && Boolean(group?.messages.some((m) => m.uid === selectedUid)));

              return (
                <div
                  key={group ? group.threadId : `${msg.folder}-${msg.uid}`}
                  data-index={item.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  <MessageListItem
                    accountId={accountId}
                    folder={folder}
                    message={msg}
                    isSelected={isSelected}
                    onSelect={() => setSelectedUid(msg.uid, msg.folder)}
                    allVisibleUids={visibleUids}
                    threadMessages={group?.messages}
                    isThreadExpanded={isExpanded}
                    onToggleThreadExpand={() => group && toggleThreadExpanded(group.threadId)}
                  />
                </div>
              );
            })}
          </div>

          {/* Indicateur de chargement pour la pagination arrière */}
          {fetchMore.isPending && !searchResults && (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin text-primary" />
              <span>Chargement des messages anciens…</span>
            </div>
          )}
        </div>
      )}

      {/* Barre d'actions groupées (Batch Actions) */}
      <BatchActionBar
        accountId={accountId}
        folder={folder}
        totalSelectable={displayedMessages.length}
        onSelectAll={handleSelectAll}
      />
    </div>
  );
}
