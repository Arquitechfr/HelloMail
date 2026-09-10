"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMessages, useFetchMore } from "@/lib/queries/messages";
import { useUIStore } from "@/lib/stores/uiStore";
import { MessageListItem } from "@/components/mail/MessageListItem";
import { SearchBar } from "@/components/mail/SearchBar";
import { Loader2, Inbox } from "lucide-react";
import type { Message } from "@/lib/api-types";
import { cn } from "@/lib/utils";

interface MessageListProps {
  accountId: string;
  folder: string;
}

export function MessageList({ accountId, folder }: MessageListProps) {
  // limit=100 (max backend) pour afficher un maximum de messages dès le chargement.
  const { data, isLoading, error, isFetching } = useMessages(accountId, folder, 1, 100);
  const fetchMore = useFetchMore(accountId);
  // `mutate` est stable en React Query v5 — ne change pas de référence entre les renders.
  const fetchMoreMutate = fetchMore.mutate;
  const selectedUid = useUIStore((s) => s.selectedUid);
  const setSelectedUid = useUIStore((s) => s.setSelectedUid);
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

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

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
        <ListHeader folder={folder} total={data?.total ?? 0} isFetching={isFetching} accountId={accountId} onResults={handleResults} />
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 text-muted-foreground p-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted/50 border border-border">
            <Inbox className="size-5 opacity-60 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">
              {searchResults ? "Aucun résultat trouvé" : "Boîte vide"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {searchResults ? "Essayez avec d'autres mots-clés" : "Aucun message dans ce dossier"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-1 md:flex-initial md:w-84 lg:w-96 flex-col border-r border-border bg-card/30 overflow-hidden select-none",
        selectedUid !== null ? "hidden md:flex" : "flex",
      )}
    >
      <ListHeader folder={folder} total={data?.total ?? 0} isFetching={isFetching} accountId={accountId} onResults={handleResults} searching={!!searchResults} />

      {/* Liste virtualisée */}
      <div ref={parentRef} className="flex-1 overflow-y-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((item) => (
            <div
              key={messages[item.index].uid}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${item.start}px)`,
              }}
            >
              <MessageListItem
                message={messages[item.index]}
                isSelected={selectedUid === messages[item.index].uid}
                onSelect={() => setSelectedUid(messages[item.index].uid)}
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
    </div>
  );
}

function ListHeader({
  folder,
  total,
  isFetching,
  accountId,
  onResults,
  searching,
}: {
  folder: string;
  total: number;
  isFetching: boolean;
  accountId: string;
  onResults: (results: unknown[] | null) => void;
  searching?: boolean;
}) {
  return (
    <div className="shrink-0 border-b border-border bg-background/60 backdrop-blur-xs">
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider font-display">
            {searching ? "Recherche" : folder}
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground border border-border/60">
            {total}
          </span>
        </div>
        {isFetching && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
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
