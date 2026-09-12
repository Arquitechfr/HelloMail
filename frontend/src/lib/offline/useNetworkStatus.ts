"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { offlineDb } from "./db";
import { replayPendingMutations } from "./offlineQueueService";
import { tabSyncHub } from "@/lib/sync/tabSyncHub";
import { toast } from "sonner";

export interface NetworkStatus {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
}

export function useNetworkStatus(): NetworkStatus {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  });
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const list = await offlineDb.getPendingMutations();
      setPendingCount(list.length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (isSyncing || !navigator.onLine) return;

    setIsSyncing(true);
    try {
      const result = await replayPendingMutations();
      await refreshPendingCount();

      if (result.applied > 0) {
        toast.success(
          `Synchronisation hors-ligne : ${result.applied} action${result.applied > 1 ? "s" : ""} appliquée${result.applied > 1 ? "s" : ""}`,
        );
        // Invalide les requêtes pour rafraîchir avec les données réelles du serveur
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["messages"] }),
          queryClient.invalidateQueries({ queryKey: ["folders"] }),
          queryClient.invalidateQueries({ queryKey: ["unified"] }),
        ]);
      }
    } catch (err) {
      console.warn("[useNetworkStatus] Erreur synchronisation:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, queryClient, refreshPendingCount]);

  const syncNowRef = useRef(syncNow);
  syncNowRef.current = syncNow;

  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  const refreshPendingCountRef = useRef(refreshPendingCount);
  refreshPendingCountRef.current = refreshPendingCount;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      toast.info("Connexion rétablie — synchronisation en cours...");
      syncNowRef.current();
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshPendingCountRef.current();
      toast.warning("Mode hors-ligne activé. Vos actions seront synchronisées au retour du réseau.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initialisation
    setIsOnline(navigator.onLine);
    refreshPendingCountRef.current();

    // Élagage automatique du cache en arrière-plan (non-bloquant)
    offlineDb.pruneOldCache().catch((err) => {
      console.warn("[offlineDb] Erreur lors de l'élagage du cache:", err);
    });

    // Synchronisation multi-onglets des mutations en attente et rejeux
    const unsubAdded = tabSyncHub.on("offline:mutation_added", () => {
      refreshPendingCountRef.current();
    });

    const unsubCompleted = tabSyncHub.on("offline:sync_completed", () => {
      refreshPendingCountRef.current();
      Promise.all([
        queryClientRef.current.invalidateQueries({ queryKey: ["messages"] }),
        queryClientRef.current.invalidateQueries({ queryKey: ["folders"] }),
        queryClientRef.current.invalidateQueries({ queryKey: ["unified"] }),
      ]).catch((err) =>
        console.warn("[useNetworkStatus] Invalidation après sync inter-onglets:", err),
      );
    });

    // Vérifier périodiquement s'il y a des mutations en attente
    const interval = setInterval(() => {
      refreshPendingCountRef.current();
    }, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
      unsubAdded();
      unsubCompleted();
    };
  }, []);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    syncNow,
  };
}
