"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/stores/authStore";
import { toast } from "sonner";
import type { RealtimeEvent } from "@/lib/api-types";

const MAX_RECONNECTS = 10;
const BASE_DELAY = 1000;
const MAX_DELAY = 30000;

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
