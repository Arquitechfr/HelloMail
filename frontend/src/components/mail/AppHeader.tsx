"use client";

import { useState } from "react";
import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import { useUIStore } from "@/lib/stores/uiStore";
import { UserDropdown } from "@/components/mail/UserDropdown";
import { ThemeToggle } from "@/components/mail/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Plus,
  RefreshCw,
  Search,
  Keyboard,
  Menu,
  Command,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { useNetworkStatus } from "@/lib/offline/useNetworkStatus";

export function AppHeader() {
  const queryClient = useQueryClient();
  const isFetchingMessages = useIsFetching({ queryKey: ["messages"] }) > 0;
  const {
    openCompose,
    openSearch,
    selectedFolder,
    toggleMobileSidebar,
    setShortcutsDialogOpen,
  } = useUIStore();
  const { isOnline, pendingCount, isSyncing: isOfflineSyncing } = useNetworkStatus();
  const [manualSyncing, setManualSyncing] = useState(false);

  const handleRefresh = async () => {
    try {
      setManualSyncing(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["messages"] }),
        queryClient.invalidateQueries({ queryKey: ["folders"] }),
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
      ]);
      toast.success("Synchronisation effectuée");
    } catch {
      toast.error("Échec de la synchronisation");
    } finally {
      setTimeout(() => setManualSyncing(false), 500);
    }
  };

  const isSyncing = isFetchingMessages || manualSyncing;

  return (
    <header className="fixed top-0 inset-x-0 h-13 z-40 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-md px-3 sm:px-4 select-none">
      {/* Côté gauche : Marque & Toggle navigation mobile */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={toggleMobileSidebar}
          aria-label="Basculer les dossiers"
        >
          <Menu className="size-4" />
        </Button>

        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs">
            <Mail className="size-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-base font-bold tracking-tight text-foreground">
              HelloMail
            </span>
          </div>
        </div>

        {/* Fil d'ariane contextuel */}
        {selectedFolder && (
          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-border text-xs text-muted-foreground">
            <span className="text-foreground font-medium">{selectedFolder}</span>
          </div>
        )}
      </div>

      {/* Centre : Raccourcis d'actions rapides façon Linear / Superhuman */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Button
          size="sm"
          className="h-8 px-2.5 sm:px-3 text-xs font-medium gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
          onClick={() => openCompose("new")}
        >
          <Plus className="size-3.5" />
          <span className="hidden sm:inline">Nouveau</span>
          <kbd className="hidden md:inline-flex h-4 items-center rounded bg-primary-foreground/20 px-1 font-mono text-[10px] text-primary-foreground">
            C
          </kbd>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 sm:px-2.5 text-xs text-muted-foreground hover:text-foreground border-border bg-card/60"
          onClick={handleRefresh}
          disabled={isSyncing}
          title="Synchroniser les emails (Cmd+R)"
        >
          <RefreshCw
            className={`size-3.5 ${isSyncing ? "animate-spin text-primary" : ""}`}
          />
          <span className="hidden lg:inline text-xs">Sync</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground border-border bg-card/60 hidden sm:flex items-center gap-1.5"
          onClick={openSearch}
        >
          <Search className="size-3.5" />
          <span className="hidden lg:inline text-xs">Rechercher</span>
          <kbd className="inline-flex h-4 items-center gap-0.5 rounded border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
            <Command className="size-2.5" /> K
          </kbd>
        </Button>
      </div>

      {/* Côté droit : Statut SSE direct, Thème, Guide raccourcis & Menu Profil */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Statut réseau & SSE */}
        {!isOnline ? (
          <div
            className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-medium text-amber-600 dark:text-amber-400"
            title={
              pendingCount > 0
                ? `${pendingCount} action(s) en attente de synchronisation`
                : "Mode hors-ligne actif"
            }
            data-testid="network-status-offline"
          >
            <WifiOff className="size-3 text-amber-600 dark:text-amber-400" />
            <span className="hidden md:inline">Hors-ligne</span>
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-500/20 px-1 text-[10px] font-semibold">
                {pendingCount}
              </span>
            )}
          </div>
        ) : isOfflineSyncing ? (
          <div
            className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[11px] font-medium text-blue-600 dark:text-blue-400"
            data-testid="network-status-syncing"
          >
            <RefreshCw className="size-3 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="hidden md:inline">Synchronisation...</span>
          </div>
        ) : (
          <div
            className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
            data-testid="network-status-online"
          >
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
            </span>
            <span className="hidden md:inline">En direct</span>
          </div>
        )}

        {/* Aide raccourcis clavier */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setShortcutsDialogOpen(true)}
          title="Guide des raccourcis clavier (?)"
          aria-label="Raccourcis clavier"
        >
          <Keyboard className="size-4 text-muted-foreground" />
        </Button>

        {/* Basculeur de thème */}
        <ThemeToggle />

        <div className="h-4 w-px bg-border mx-0.5 sm:mx-1" />

        {/* Menu déroulant utilisateur */}
        <UserDropdown />
      </div>
    </header>
  );
}
