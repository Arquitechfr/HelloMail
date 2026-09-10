"use client";

import { useEffect } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/authStore";
import type { User } from "@/lib/api-types";

/**
 * Hook d'authentification — bootstrap de session au mount.
 *
 * Au chargement de l'app, l'access token est en mémoire (perdu au refresh page).
 * On tente `GET /api/auth/me` sans token → 401 → interceptor déclenche le refresh
 * via le cookie httpOnly → nouvel access token stocké → useMe réussit.
 * Tant que le cookie refresh est valide (30j), la session est restaurée silencieusement.
 */
export function useAuthBootstrap() {
  const { accessToken, user, isRestoringSession, setAuth, setRestoringSession } = useAuthStore();

  useEffect(() => {
    if (accessToken && user) {
      setRestoringSession(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const data = await apiFetch<{ user: User }>("/api/auth/me");
        if (!cancelled && data.user) {
          const { accessToken: token } = useAuthStore.getState();
          if (token) {
            setAuth(token, data.user);
          } else {
            useAuthStore.setState({ user: data.user, isRestoringSession: false });
          }
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          // Refresh échoué → non authentifié.
          useAuthStore.getState().clearAuth();
        } else {
          setRestoringSession(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, user, setAuth, setRestoringSession]);

  return { isRestoringSession, isAuthenticated: !!accessToken };
}
