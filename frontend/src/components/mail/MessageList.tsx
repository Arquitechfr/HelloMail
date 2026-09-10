"use client";

import { useRef, useState, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMessages } from "@/lib/queries/messages";
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
  const { data, isLoading, error, isFetching } = useMessages(accountId, folder);
  const selectedUid = useUIStore((s) => s.selectedUid);
  const setSelectedUid = useUIStore((s) => s.setSelectedUid);
  const parentRef = useRef<HTMLDivElement>(null);
  const [searchResults, setSearchResults] = useState<Message[] | null>(null);

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
