import { create } from "zustand";
import type { User } from "@/lib/api-types";

/**
 * Store d'authentification — access token en mémoire uniquement.
 * Jamais persisté (pas de localStorage) pour éviter le vol via XSS.
 * Le refresh token est géré via cookie httpOnly par le backend.
 */
interface AuthState {
  accessToken: string | null;
  user: User | null;
  isRestoringSession: boolean;
  setAuth: (accessToken: string, user: User) => void;
  setRestoringSession: (value: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isRestoringSession: true,
  setAuth: (accessToken, user) => set({ accessToken, user, isRestoringSession: false }),
  setRestoringSession: (value) => set({ isRestoringSession: value }),
  clearAuth: () => set({ accessToken: null, user: null, isRestoringSession: false }),
}));
