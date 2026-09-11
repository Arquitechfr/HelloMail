"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/stores/authStore";
import { useUIStore } from "@/lib/stores/uiStore";
import { refreshToken } from "@/lib/api";
import { playNotificationSound, showDesktopNotification } from "@/lib/notifications";
import { toast } from "sonner";
import type { RealtimeEvent } from "@/lib/api-types";

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
 * Hook SSE — connexion temps réel vers /api/events?token=<accessToken>.
 * - Invalide les queries TanStack sur les événements.
 * - Reconnexion avec backoff exponentiel (1s → 30s).
 * - Limite de reconnexions (10) → toast après dépassement.
 * - Cleanup systématique au unmount.
 */
export function useSSE(enabled: boolean) {
  const qc = useQueryClient();
  const { accessToken } = useAuthStore();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled || !accessToken) return;

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      const es = new EventSource(`/api/events?token=${accessToken}`);
      eventSourceRef.current = es;

      es.addEventListener("connected", () => {
        reconnectCountRef.current = 0;
        setConnected(true);
      });

      es.addEventListener("message:new", (e) => {
        const event = JSON.parse(e.data) as RealtimeEvent;
        // refetchType: 'active' force le refetch même si la query est stale.
        qc.invalidateQueries({ queryKey: ["messages", event.accountId], refetchType: "active" });
        qc.invalidateQueries({ queryKey: ["folders", event.accountId], refetchType: "active" });

        const uiState = useUIStore.getState();
        if (uiState.notificationSoundEnabled) {
          playNotificationSound();
        }

        const payload = event.payload as { folder?: string; uid?: number } | undefined;
        const targetFolder = payload?.folder || "INBOX";
        const targetUid = payload?.uid;

        if (uiState.desktopNotificationsEnabled) {
          showDesktopNotification({
            title: "HelloMail — Nouveau message",
            body: `Nouveau message reçu dans ${targetFolder}`,
            onClick: () => {
              uiState.setSelectedAccount(event.accountId);
              uiState.setSelectedFolder(targetFolder);
              if (targetUid) uiState.setSelectedUid(targetUid);
            },
          });
        }
      });

      es.addEventListener("message:deleted", (e) => {
        const event = JSON.parse(e.data) as RealtimeEvent;
        qc.invalidateQueries({ queryKey: ["messages", event.accountId] });
        qc.invalidateQueries({ queryKey: ["folders", event.accountId] });
      });

      es.addEventListener("message:flags", (e) => {
        const event = JSON.parse(e.data) as RealtimeEvent;
        qc.invalidateQueries({ queryKey: ["messages", event.accountId] });
        qc.invalidateQueries({ queryKey: ["folders", event.accountId] });
      });

      es.addEventListener("account:syncError", () => {
        qc.invalidateQueries({ queryKey: ["accounts"] });
        toast.error("Erreur de synchronisation sur un compte");
      });

      es.onerror = () => {
        setConnected(false);
        es.close();

        if (cancelled) return;

        // Token expiré (ex. onglet ouvert > 15 min) : le refresh met à jour le
        // store, ce qui relance cet effet avec le nouveau token — pas de timer.
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
  }, [enabled, accessToken, qc]);

  return { connected };
}
