import { create } from "zustand";
import type { User } from "@/lib/api-types";
import { tabSyncHub } from "@/lib/sync/tabSyncHub";
import type { AuthLoginPayload, AuthTokenRefreshedPayload } from "@/lib/sync/tabSyncTypes";

/**
 * Store d'authentification — access token en mémoire uniquement.
 * Jamais persisté (pas de localStorage) pour éviter le vol via XSS.
 * Le refresh token est géré via cookie httpOnly par le backend.
 * Synchronisé en temps réel entre tous les onglets ouverts via BroadcastChannel.
 */
interface AuthState {
  accessToken: string | null;
  user: User | null;
  isRestoringSession: boolean;
  setAuth: (accessToken: string, user: User, broadcast?: boolean) => void;
  setRestoringSession: (value: boolean) => void;
  clearAuth: (broadcast?: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Synchronisation inter-onglets automatique via TabSyncHub
  tabSyncHub.subscribe<AuthLoginPayload>("auth:login", (payload) => {
    set({ accessToken: payload.accessToken, user: payload.user, isRestoringSession: false });
  });

  tabSyncHub.subscribe("auth:logout", () => {
    set({ accessToken: null, user: null, isRestoringSession: false });
  });

  tabSyncHub.subscribe<AuthTokenRefreshedPayload>("auth:token_refreshed", (payload) => {
    set((state) => ({
      accessToken: payload.accessToken,
      user: payload.user || state.user,
      isRestoringSession: false,
    }));
  });

  return {
    accessToken: null,
    user: null,
    isRestoringSession: true,
    setAuth: (accessToken, user, broadcast = true) => {
      set({ accessToken, user, isRestoringSession: false });
      if (broadcast) {
        tabSyncHub.broadcast<AuthLoginPayload>("auth:login", { accessToken, user });
      }
    },
    setRestoringSession: (value) => set({ isRestoringSession: value }),
    clearAuth: (broadcast = true) => {
      set({ accessToken: null, user: null, isRestoringSession: false });
      if (broadcast) {
        tabSyncHub.broadcast("auth:logout", {});
      }
    },
  };
});
