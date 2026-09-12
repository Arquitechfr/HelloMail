"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/stores/authStore";
import { useUIStore } from "@/lib/stores/uiStore";
import { refreshToken } from "@/lib/api";
import { playNotificationSound, showDesktopNotification } from "@/lib/notifications";
import { toast } from "sonner";
import { leaderElection } from "@/lib/sync/leaderElection";
import { tabSyncHub } from "@/lib/sync/tabSyncHub";
import type { RealtimeEvent, RealtimeEventType } from "@/lib/api-types";
import type { SseEventPayload } from "@/lib/sync/tabSyncTypes";

const MAX_RECONNECTS = 10;
const BASE_DELAY = 1000;
const MAX_DELAY = 30000;

/**
 * Détecte un JWT expiré ou sur le point d'expirer (skew 30s).
 * L'access token a une durée de vie courte (~15 min) : une connexion SSE qui
 * survit à son token ne peut plus se reconnecter sans refresh préalable.
 */
export function isTokenExpiredOrExpiring(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1])) as { exp?: number };
    return typeof payload.exp !== "number" || payload.exp * 1000 < Date.now() + 30_000;
  } catch {
    return true;
  }
}

/**
 * Hook SSE avec synchronisation inter-onglets (Multiplexage & Leader Election).
 * - Seul l'onglet "Leader" maintient la socket EventSource ouverte vers /api/events.
 * - Les événements SSE sont relayés aux autres onglets via BroadcastChannel.
 * - En cas de fermeture du leader, un suiveur reprend instantanément le rôle.
 */
export function useSSE(enabled: boolean) {
  const qc = useQueryClient();
  const { accessToken, user } = useAuthStore();
  const [isLeader, setIsLeader] = useState(false);
  const [connected, setConnected] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Démarrage de l'élection de leader
  useEffect(() => {
    if (!enabled || !accessToken) return;

    leaderElection.start();
    const unsub = leaderElection.onLeaderChange((leader) => {
      setIsLeader(leader);
    });

    return () => {
      unsub();
      leaderElection.stop();
    };
  }, [enabled, accessToken]);

  // 2. Dispatcher d'événement commun (exécuté par tous les onglets)
  const handleRealtimeEvent = (event: RealtimeEvent) => {
    switch (event.type) {
      case "message:new": {
        qc.invalidateQueries({ queryKey: ["messages", event.accountId], refetchType: "active" });
        qc.invalidateQueries({ queryKey: ["folders", event.accountId], refetchType: "active" });
        qc.invalidateQueries({ queryKey: ["unified"], refetchType: "active" });

        const uiState = useUIStore.getState();
        if (uiState.notificationSoundEnabled) {
          playNotificationSound();
        }

        const payload = event.payload as { folder?: string; uid?: number } | undefined;
        const targetFolder = payload?.folder || "INBOX";
        const targetUid = payload?.uid;

        if (uiState.desktopNotificationsEnabled) {
          showDesktopNotification({
            title: "Mailora — Nouveau message",
            body: `Nouveau message reçu dans ${targetFolder}`,
            onClick: () => {
              uiState.setSelectedAccount(event.accountId);
              uiState.setSelectedFolder(targetFolder);
              if (targetUid) uiState.setSelectedUid(targetUid);
            },
          });
        }
        break;
      }

      case "message:deleted":
      case "message:flags": {
        qc.invalidateQueries({ queryKey: ["messages", event.accountId] });
        qc.invalidateQueries({ queryKey: ["folders", event.accountId] });
        qc.invalidateQueries({ queryKey: ["unified"] });
        break;
      }

      case "account:syncError": {
        qc.invalidateQueries({ queryKey: ["accounts"] });
        toast.error("Erreur de synchronisation sur un compte");
        break;
      }

      case "reminder:triggered": {
        qc.invalidateQueries({ queryKey: ["reminders", event.accountId] });
        qc.invalidateQueries({ queryKey: ["messages", event.accountId] });
        qc.invalidateQueries({ queryKey: ["folders", event.accountId] });

        const payload = event.payload as {
          subject?: string;
          note?: string;
          folder?: string;
          uid?: number;
        } | undefined;

        const subject = payload?.subject || "cet email";
        toast.warning(`🔔 Rappel de relance : pas de réponse à « ${subject} »`, {
          description: payload?.note || "Pensez à relancer votre correspondant.",
          action:
            payload?.folder && payload?.uid
              ? {
                  label: "Voir",
                  onClick: () => {
                    const uiState = useUIStore.getState();
                    uiState.setSelectedAccount(event.accountId);
                    uiState.setSelectedFolder(payload.folder!);
                    uiState.setSelectedUid(payload.uid!);
                  },
                }
              : undefined,
        });

        const uiState = useUIStore.getState();
        if (uiState.notificationSoundEnabled) {
          playNotificationSound();
        }
        break;
      }

      case "reminder:resolved": {
        qc.invalidateQueries({ queryKey: ["reminders", event.accountId] });
        qc.invalidateQueries({ queryKey: ["messages", event.accountId] });
        break;
      }

      default: {
        qc.invalidateQueries({ queryKey: ["messages"] });
        qc.invalidateQueries({ queryKey: ["folders"] });
        break;
      }
    }
  };

  // 3. Écoute des événements relayés via le BroadcastChannel (pour followers et leaders)
  useEffect(() => {
    if (!enabled || !accessToken) return;

    const unsub = tabSyncHub.subscribe<SseEventPayload>("sse:event", (payload) => {
      // Isolation utilisateur : ignorer si l'événement appartient à un autre compte
      if (payload.userId && user?.id && payload.userId !== user.id) {
        return;
      }
      handleRealtimeEvent(payload.event);
    });

    return () => {
      unsub();
    };
  }, [enabled, accessToken, user?.id, qc]);

  // 4. Gestion de la connexion EventSource (UNIQUEMENT POUR LE LEADER)
  useEffect(() => {
    if (!enabled || !accessToken || !isLeader) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setConnected(false);
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      const es = new EventSource(`/api/events?token=${accessToken}`);
      eventSourceRef.current = es;

      const forwardAndHandle = (type: RealtimeEventType, rawData: string) => {
        try {
          const event = JSON.parse(rawData) as RealtimeEvent;
          event.type = type;
          // 1. Relayer aux autres onglets
          tabSyncHub.broadcast<SseEventPayload>("sse:event", {
            event,
            userId: user?.id,
          });
          // 2. Traiter localement dans l'onglet leader
          handleRealtimeEvent(event);
        } catch (err) {
          console.warn("[useSSE] Erreur parsing événement:", err);
        }
      };

      es.addEventListener("connected", () => {
        reconnectCountRef.current = 0;
        setConnected(true);
      });

      es.addEventListener("message:new", (e) => forwardAndHandle("message:new", e.data));
      es.addEventListener("message:deleted", (e) => forwardAndHandle("message:deleted", e.data));
      es.addEventListener("message:flags", (e) => forwardAndHandle("message:flags", e.data));
      es.addEventListener("account:syncError", (e) => forwardAndHandle("account:syncError", e.data));

      es.onerror = () => {
        setConnected(false);
        es.close();

        if (cancelled) return;

        const currentToken = useAuthStore.getState().accessToken;
        if (currentToken && isTokenExpiredOrExpiring(currentToken)) {
          void refreshToken();
          return;
        }

        if (reconnectCountRef.current >= MAX_RECONNECTS) {
          toast.error("Reconnexion temps réel impossible, rechargez la page");
          return;
        }

        const delay = Math.min(BASE_DELAY * 2 ** reconnectCountRef.current, MAX_DELAY);
        reconnectCountRef.current++;
        reconnectTimerRef.current = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setConnected(false);
    };
  }, [enabled, accessToken, isLeader, user?.id]);

  return { connected: isLeader ? connected : true, isLeader };
}
