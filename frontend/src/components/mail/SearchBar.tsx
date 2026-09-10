"use client";

import { useState, useEffect, useRef } from "react";
import { useSearch } from "@/lib/queries/messages";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  accountId: string;
  onResults: (results: unknown[] | null) => void;
}

/**
 * Barre de recherche avec opérateurs backend.
 * Opérateurs : from:, to:, subject:, is:unread, is:flagged, has:attachment, before:, since:
 * Debounce 300ms sur la saisie.
 */
export function SearchBar({ accountId, onResults }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
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
    <div className="relative">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher... (from:, to:, subject:, is:unread, has:attachment)"
        className="glass h-9 pl-9 pr-9 text-sm"
      />
      {isFetching && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="size-3 animate-pulse rounded-full bg-primary" />
        </div>
      )}
      {query && !isFetching && (
        <button
          onClick={() => setQuery("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
