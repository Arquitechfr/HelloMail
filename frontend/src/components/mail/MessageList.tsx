"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMessages, useFetchMore } from "@/lib/queries/messages";
import { useUIStore } from "@/lib/stores/uiStore";
import { MessageListItem } from "@/components/mail/MessageListItem";
import { SearchBar } from "@/components/mail/SearchBar";
import { GlassPanel } from "@/components/mail/GlassPanel";
import { Loader2, Inbox } from "lucide-react";
import type { Message } from "@/lib/api-types";

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
      <GlassPanel className="flex flex-1 items-center justify-center border-r">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </GlassPanel>
    );
  }

  if (error) {
    return (
      <GlassPanel className="flex flex-1 flex-col items-center justify-center gap-2 border-r text-muted-foreground">
        <p className="text-sm">Impossible de charger les messages</p>
      </GlassPanel>
    );
  }

  if (messages.length === 0) {
    return (
      <GlassPanel className="flex flex-1 flex-col border-r">
        <ListHeader folder={folder} total={data?.total ?? 0} isFetching={isFetching} accountId={accountId} onResults={handleResults} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <Inbox className="size-10 opacity-40" />
          <p className="text-sm">{searchResults ? "Aucun résultat" : "Aucun message dans ce dossier"}</p>
        </div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="flex flex-1 flex-col border-r">
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
            <Loader2 className="size-3 animate-spin" />
            <span>Chargement des messages plus anciens…</span>
          </div>
        )}
      </div>
    </GlassPanel>
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
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">{searching ? "Recherche" : folder}</h2>
        <span className="text-xs text-muted-foreground">
          {total} message{total > 1 ? "s" : ""}
          {isFetching ? " · sync…" : ""}
        </span>
      </div>
      <div className="px-3 py-2 border-b border-border">
        <SearchBar accountId={accountId} onResults={onResults} />
      </div>
    </>
  );
}
