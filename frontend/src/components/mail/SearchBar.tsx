"use client";

import { useState, useEffect, useRef } from "react";
import { useSearch } from "@/lib/queries/messages";
import { Input } from "@/components/ui/input";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { AdvancedSearchDialog } from "./AdvancedSearchDialog";

interface SearchBarProps {
  accountId: string;
  onResults: (results: unknown[] | null) => void;
}

/**
 * Barre de recherche avec opérateurs backend.
 * Opérateurs : from:, to:, subject:, is:unread, is:flagged, has:attachment, before:, since:, larger:, smaller:
 * Debounce 300ms sur la saisie.
 */
export function SearchBar({ accountId, onResults }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce 300ms.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebounced(query), 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  const { data, isFetching } = useSearch(accountId, debounced);

  // Notifie le parent des résultats.
  useEffect(() => {
    if (debounced.length === 0) {
      onResults(null);
    } else {
      onResults(data?.data ?? []);
    }
  }, [data, debounced, onResults]);

  return (
    <>
      <div className="relative w-full">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          id="mail-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQuery("");
              (e.target as HTMLElement).blur();
            }
          }}
          placeholder="Filtrer... (ex: from:alex is:unread)"
          className="h-8 pl-8 pr-14 text-xs bg-muted/40 border-border/80 focus-visible:bg-background focus-visible:border-primary/50 transition-colors rounded-md placeholder:text-muted-foreground/70"
        />
        {isFetching && (
          <div className="absolute right-8 top-1/2 -translate-y-1/2">
            <div className="size-2.5 animate-pulse rounded-full bg-primary" />
          </div>
        )}
        {data?.source === "server" && !isFetching && (
          <span
            className="absolute right-12 top-1/2 -translate-y-1/2 rounded border border-border bg-muted/60 px-1 py-px text-[9px] font-medium text-muted-foreground"
            title="Recherche étendue à l'ensemble du serveur de messagerie"
          >
            serveur
          </span>
        )}
        {query && !isFetching && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-7 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
            aria-label="Effacer la recherche"
          >
            <X className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setAdvancedOpen(true)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary p-0.5 transition-colors cursor-pointer"
          title="Ouvrir la recherche avancée (filtres multi-critères)"
          aria-label="Recherche avancée"
        >
          <SlidersHorizontal className="size-3.5" />
        </button>
      </div>

      {advancedOpen && (
        <AdvancedSearchDialog
          open={advancedOpen}
          onOpenChange={setAdvancedOpen}
          initialAccountId={accountId}
          onSearch={(queryStr) => {
            setQuery(queryStr);
          }}
        />
      )}
    </>
  );
}
