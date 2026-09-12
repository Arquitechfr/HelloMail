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
  // limit=100 (max backend) pour afficher un maximum de messages dès le chargement.
  const { data, isLoading, error, isFetching } = useMessages(
    accountId,
    folder,
    1,
    100,
    selectedTag,
  );
  const fetchMore = useFetchMore(accountId);
  // `mutate` est stable en React Query v5 — ne change pas de référence entre les renders.
  const fetchMoreMutate = fetchMore.mutate;
  const selectedUid = useUIStore((s) => s.selectedUid);
  const setSelectedUid = useUIStore((s) => s.setSelectedUid);
  const quickFilter = useUIStore((s) => s.quickFilter);
  const setQuickFilter = useUIStore((s) => s.setQuickFilter);
  const parentRef = useRef<HTMLDivElement>(null);
  const [searchResults, setSearchResults] = useState<Message[] | null>(null);

  // Garde-fou pagination arrière :
  // - `hasMoreRef` : false quand le dernier fetch-more a retourné 0 (plus de messages anciens)
  //   ou quand une erreur s'est produite (429, etc.). Reset quand le dossier change.
  // - `fetchingRef` : true pendant qu'un fetch-more est en cours.
  // - `lastFetchTimeRef` : timestamp du dernier fetch-more pour imposer un cooldown (3s).
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

  // Utilise les résultats de recherche si présents, sinon les messages du dossier.
  const messages = searchResults ?? data?.data ?? [];

  const filteredMessages = useMemo(() => filterMessages(messages, quickFilter), [messages, quickFilter]);
  const filterCounts = useMemo(() => computeFilterCounts(messages), [messages]);

  const displayDensity = useUIStore((s) => s.displayDensity);
  const estimateItemSize = useCallback(() => {
    switch (displayDensity) {
      case "compact":
        return 44;
      case "spacious":
        return 92;
      case "comfortable":
      default:
        return 72;
    }
  }, [displayDensity]);

  const virtualizer = useVirtualizer({
    count: filteredMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: estimateItemSize,
    overscan: 10,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [displayDensity, virtualizer]);

  // Pagination arrière : déclenche fetchMore quand l'utilisateur scroll near the bottom.
  const virtualItems = virtualizer.getVirtualItems();
  const isNearBottom = virtualItems.length > 0 && virtualItems[virtualItems.length - 1].index >= messages.length - 5;

  useEffect(() => {
    // Ne déclenche que hors recherche, avec des messages chargés, pas déjà en cours,
    // s'il reste potentiellement des messages à fetcher, et après le cooldown (3s).
    if (
      isNearBottom &&
      !searchResults &&
      messages.length > 0 &&
      !fetchingRef.current &&
      hasMoreRef.current &&
      Date.now() - lastFetchTimeRef.current >= 3000
    ) {
      fetchingRef.current = true;
      lastFetchTimeRef.current = Date.now();
      fetchMoreMutate(
        { folder },
        {
          onSuccess: (result) => {
            fetchingRef.current = false;
            // Si le backend n'a rien fetché, on marque qu'il n'y a plus de messages anciens.
            if (result.fetched === 0) {
              hasMoreRef.current = false;
            }
          },
          onError: () => {
            fetchingRef.current = false;
            // Sur erreur (429 rate limit, etc.), on stoppe les tentatives.
            hasMoreRef.current = false;
          },
        },
      );
    }
  }, [isNearBottom, searchResults, messages.length, fetchMoreMutate, folder]);

  const { visibleUids, handleSelectAll } = useListNavigationShortcuts({
    items: filteredMessages,
    selectedUid,
    onSelectUid: setSelectedUid,
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
      {filteredMessages.length === 0 ? (
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
            {virtualizer.getVirtualItems().map((item) => (
              <div
                key={filteredMessages[item.index].uid}
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
                  message={filteredMessages[item.index]}
                  isSelected={selectedUid === filteredMessages[item.index].uid}
                  onSelect={() => setSelectedUid(filteredMessages[item.index].uid)}
                  allVisibleUids={visibleUids}
                />
              </div>
            ))}
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
        totalSelectable={filteredMessages.length}
        onSelectAll={handleSelectAll}
      />
    </div>
  );
}
