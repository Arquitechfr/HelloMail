"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/lib/stores/uiStore";
import { useAccounts } from "@/lib/queries/accounts";
import { useSearch } from "@/lib/queries/messages";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Loader2, X, Mail, Paperclip, Star, Tag, Folder } from "lucide-react";
import { formatDate } from "@/lib/utils";
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
  const [activeAccountId, setActiveAccountId] = useState<string>("");
  const effectiveAccountId = activeAccountId || selectedAccountId || accounts?.[0]?._id || "";

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
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

  const { data, isFetching } = useSearch(effectiveAccountId || null, debounced);
  const results = (data?.data ?? []) as Message[];

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
    setSelectedAccount(effectiveAccountId);
    setSelectedFolder(msg.folder);
    setSelectedUid(msg.uid);
    router.push(`/mail/${effectiveAccountId}/${encodeURIComponent(msg.folder)}`);
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
    <Dialog
      open={searchDialogOpen}
      onOpenChange={(open) => {
        setSearchDialogOpen(open);
        if (open) {
          setSelectedIndex(0);
          setActiveAccountId("");
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

        {/* Barre de recherche principale avec icône */}
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

        {/* Sélecteur de compte multi-comptes + Chips de filtres rapides */}
        <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-2 bg-muted/10 text-xs overflow-x-auto">
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
          </div>

          {/* Sélecteur de compte si multiple */}
          {accounts && accounts.length > 1 && (
            <select
              value={effectiveAccountId}
              onChange={(e) => setActiveAccountId(e.target.value)}
              className="h-6 rounded border border-border bg-background px-1.5 text-[11px] text-muted-foreground focus:outline-hidden"
            >
              {accounts.map((acc) => (
                <option key={acc._id} value={acc._id}>
                  {acc.displayName || acc.emailAddress}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Indicateur de recherche étendue au serveur IMAP */}
        {data?.source === "server" && !isFetching && (
          <div className="flex items-center gap-1.5 border-b border-border/60 bg-primary/5 px-4 py-1.5 text-[11px] text-muted-foreground">
            <Search className="size-3 text-primary" />
            Résultats étendus à l&apos;ensemble du serveur de messagerie
          </div>
        )}

        {/* Résultats de recherche ou guide syntaxique */}
        <div className="max-h-[380px] overflow-y-auto p-2">
          {!effectiveAccountId ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Aucun compte configuré.
            </div>
          ) : debounced.length === 0 ? (
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
                  <span className="font-mono text-primary font-semibold">subject:réunion</span>
                  <p className="text-muted-foreground text-[10px]">Dans l&apos;objet du message</p>
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
              {results.map((msg, index) => {
                const isSelected = index === selectedIndex;
                const isUnread = !msg.flags.seen;
                const senderName = msg.from?.name || msg.from?.address || "Inconnu";

                return (
                  <button
                    key={`${msg.folder}-${msg.uid}`}
                    type="button"
                    onClick={() => handleSelectMessage(msg)}
                    className={`flex items-start justify-between gap-3 w-full text-left rounded-lg p-2.5 transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs truncate ${
                            isUnread ? "font-bold text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {senderName}
                        </span>
                        <span className="inline-flex items-center rounded border border-border bg-muted/50 px-1.5 py-0 text-[10px] text-muted-foreground h-4 shrink-0">
                          <Folder className="size-2.5 mr-0.5" />
                          {msg.folder}
                        </span>
                        {msg.flags.flagged && (
                          <Star className="size-3 fill-amber-400 text-amber-400 shrink-0" />
                        )}
                        {msg.hasAttachments && (
                          <Paperclip className="size-3 text-muted-foreground shrink-0" />
                        )}
                        {msg.tags && msg.tags.length > 0 && (
                          <Tag className="size-2.5 text-primary shrink-0" />
                        )}
                      </div>
                      <p
                        className={`text-xs truncate ${
                          isUnread ? "font-semibold text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {msg.subject || "(Sans objet)"}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap pt-0.5">
                      {msg.date ? formatDate(msg.date) : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
