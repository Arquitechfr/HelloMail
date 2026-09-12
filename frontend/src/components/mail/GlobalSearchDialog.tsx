"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/lib/stores/uiStore";
import { useAccounts } from "@/lib/queries/accounts";
import { useSearch } from "@/lib/queries/messages";
import { useUnifiedSearch } from "@/lib/queries/unified";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Loader2, X, Mail, Paperclip, Star, Tag, Folder, Sparkles, SlidersHorizontal } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { SmartFolderDialog } from "./smart/SmartFolderDialog";
import { AdvancedSearchDialog } from "./AdvancedSearchDialog";
import { GlobalSearchResultItem } from "./GlobalSearchResultItem";
import type { Message } from "@/lib/api-types";

const QUICK_FILTERS = [
  { label: "Non lus", query: "is:unread", icon: Mail },
  { label: "Importants", query: "is:flagged", icon: Star },
  { label: "Avec PJ", query: "has:attachment", icon: Paperclip },
];

export function GlobalSearchDialog() {
  const router = useRouter();
  const {
    searchDialogOpen,
    setSearchDialogOpen,
    closeSearch,
    selectedAccountId,
    setSelectedAccount,
    setSelectedFolder,
    setSelectedUid,
  } = useUIStore();

  const { data: accounts } = useAccounts();
  const [activeAccountId, setActiveAccountId] = useState<string>("all");
  const effectiveAccountId = activeAccountId || selectedAccountId || "all";

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [smartFolderDialogOpen, setSmartFolderDialogOpen] = useState(false);
  const [advancedDialogOpen, setAdvancedDialogOpen] = useState(false);
  const [savedQuery, setSavedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus automatique du champ de recherche à l'ouverture
  useEffect(() => {
    if (searchDialogOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [searchDialogOpen]);

  // Debounce 300ms sur la recherche
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Recherche unifiée si "all", sinon recherche par compte individuel
  const isUnified = effectiveAccountId === "all";
  const { data: unifiedData, isFetching: isUnifiedFetching } = useUnifiedSearch(
    { q: debounced },
    searchDialogOpen && debounced.length > 0 && isUnified,
  );
  const { data: accountData, isFetching: isAccountFetching } = useSearch(
    isUnified ? null : effectiveAccountId,
    debounced,
  );

  const searchData = isUnified ? unifiedData : accountData;
  const isFetching = isUnified ? isUnifiedFetching : isAccountFetching;
  const results = (searchData?.data ?? []) as Message[];

  // Raccourci global Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setSearchDialogOpen(!searchDialogOpen);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchDialogOpen, setSearchDialogOpen]);

  const handleSelectMessage = (msg: Message) => {
    closeSearch();
    const targetAccountId = msg.accountId || (effectiveAccountId !== "all" ? effectiveAccountId : accounts?.[0]?._id);
    if (!targetAccountId) return;
    setSelectedAccount(String(targetAccountId));
    setSelectedFolder(msg.folder);
    setSelectedUid(msg.uid);
    router.push(`/mail/${targetAccountId}/${encodeURIComponent(msg.folder)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      handleSelectMessage(results[selectedIndex]);
    }
  };

  const handleAppendFilter = (filterQuery: string) => {
    if (query.includes(filterQuery)) return;
    setQuery((prev) => (prev ? `${prev.trim()} ${filterQuery}` : filterQuery));
    inputRef.current?.focus();
  };

  return (
    <>
      <Dialog
        open={searchDialogOpen}
        onOpenChange={(open) => {
          setSearchDialogOpen(open);
          if (open) {
            setSelectedIndex(0);
          }
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          className="sm:max-w-2xl border border-border bg-card p-0 shadow-2xl overflow-hidden rounded-xl gap-0"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Recherche d&apos;emails</DialogTitle>
          </DialogHeader>

          {/* Barre de recherche principale */}
          <div className="flex items-center border-b border-border px-4 py-3 bg-muted/20">
            <Search className="size-4 text-muted-foreground mr-2.5 shrink-0" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher des emails... (ex: facturation from:alex is:unread)"
              className="h-9 border-none bg-transparent shadow-none px-0 text-sm focus-visible:ring-0 placeholder:text-muted-foreground"
            />
            {isFetching ? (
              <Loader2 className="size-4 animate-spin text-primary shrink-0 ml-2" />
            ) : query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                Échap
              </kbd>
            )}
          </div>

          {/* Filtres rapides & Sélecteur de compte */}
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-2 bg-muted/10 text-xs overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 shrink-0">
              {QUICK_FILTERS.map((f) => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.query}
                    type="button"
                    onClick={() => handleAppendFilter(f.query)}
                    className="inline-flex items-center gap-1 rounded-md bg-muted/60 hover:bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground border border-border/50 transition-colors cursor-pointer"
                  >
                    <Icon className="size-3" />
                    {f.label}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setAdvancedDialogOpen(true)}
                className="inline-flex items-center gap-1 rounded-md bg-muted/60 hover:bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground border border-border/50 transition-colors cursor-pointer"
                title="Constructeur visuel de filtres avancés"
              >
                <SlidersHorizontal className="size-3" />
                Avancée
              </button>

              {debounced.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSavedQuery(debounced);
                    closeSearch();
                    setSmartFolderDialogOpen(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 text-[11px] font-medium border border-primary/20 transition-colors cursor-pointer"
                  title="Enregistrer cette recherche comme dossier intelligent"
                >
                  <Sparkles className="size-3 text-amber-500" />
                  Dossier intelligent
                </button>
              )}
            </div>

            {/* Sélecteur de compte */}
            {accounts && accounts.length > 1 && (
              <select
                value={effectiveAccountId}
                onChange={(e) => setActiveAccountId(e.target.value)}
                className="h-6 rounded border border-border bg-background px-1.5 text-[11px] text-muted-foreground focus:outline-hidden"
              >
                <option value="all">Tous les comptes</option>
                {accounts.map((acc) => (
                  <option key={acc._id} value={acc._id}>
                    {acc.displayName || acc.emailAddress}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Indicateur de recherche étendue */}
          {searchData?.source === "server" && !isFetching && (
            <div className="flex items-center gap-1.5 border-b border-border/60 bg-primary/5 px-4 py-1.5 text-[11px] text-muted-foreground">
              <Search className="size-3 text-primary" />
              Résultats étendus à l&apos;ensemble du serveur de messagerie
            </div>
          )}

          {/* Résultats de recherche */}
          <div className="max-h-[380px] overflow-y-auto no-scrollbar p-2">
            {debounced.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <p className="text-xs font-medium text-foreground mb-1">
                  Recherchez par mot-clé ou avec des opérateurs
                </p>
                <p className="text-[11px] text-muted-foreground mb-4">
                  Tapez directement vos termes ou utilisez des filtres puissants.
                </p>
                <div className="grid grid-cols-2 gap-2 text-left max-w-sm mx-auto">
                  <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-[11px]">
                    <span className="font-mono text-primary font-semibold">from:alex</span>
                    <p className="text-muted-foreground text-[10px]">Emails d&apos;un expéditeur</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-[11px]">
                    <span className="font-mono text-primary font-semibold">has:attachment</span>
                    <p className="text-muted-foreground text-[10px]">Avec pièces jointes</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-[11px]">
                    <span className="font-mono text-primary font-semibold">larger:5M</span>
                    <p className="text-muted-foreground text-[10px]">Taille supérieure à 5 Mo</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-[11px]">
                    <span className="font-mono text-primary font-semibold">is:unread</span>
                    <p className="text-muted-foreground text-[10px]">Messages non lus</p>
                  </div>
                </div>
              </div>
            ) : results.length === 0 && !isFetching ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Aucun email trouvé pour « {debounced} ».
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {results.map((msg, index) => (
                  <GlobalSearchResultItem
                    key={`${msg.folder}-${msg.uid}`}
                    message={msg}
                    isSelected={index === selectedIndex}
                    onSelect={handleSelectMessage}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SmartFolderDialog
        open={smartFolderDialogOpen}
        onOpenChange={setSmartFolderDialogOpen}
        initialQuery={savedQuery}
      />

      {advancedDialogOpen && (
        <AdvancedSearchDialog
          open={advancedDialogOpen}
          onOpenChange={setAdvancedDialogOpen}
          initialAccountId={effectiveAccountId}
          onSearch={(queryStr) => {
            setQuery(queryStr);
            inputRef.current?.focus();
          }}
        />
      )}
    </>
  );
}
