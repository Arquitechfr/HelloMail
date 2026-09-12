import { useAuthStore } from "@/lib/stores/authStore";
import { tabSyncHub } from "@/lib/sync/tabSyncHub";
import type { AuthTokenRefreshedPayload } from "@/lib/sync/tabSyncTypes";
import type { ApiErrorBody } from "@/lib/api-types";

/**
 * Erreur API structurée pour affichage formulaires.
 */
export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string[]>;

  constructor(status: number, message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

// Lock en vol pour le refresh — évite les appels multiples simultanés.
let refreshPromise: Promise<string | null> | null = null;

/**
 * Rafraîchit le token via la Route Handler Next.js (server-side).
 * La Route Handler forward le cookie httpOnly vers le backend.
 * Retourne le nouvel access token ou null si échec.
 */
export async function refreshToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        useAuthStore.getState().clearAuth();
        return null;
      }

      const data = (await res.json()) as { accessToken: string; user?: import("@/lib/api-types").User };
      // Met à jour le store avec le token et les données utilisateur
      const store = useAuthStore.getState();
      store.setRestoringSession(false);
      useAuthStore.setState({
        accessToken: data.accessToken,
        ...(data.user ? { user: data.user } : {}),
      });
      tabSyncHub.broadcast<AuthTokenRefreshedPayload>("auth:token_refreshed", {
        accessToken: data.accessToken,
        user: data.user,
      });
      return data.accessToken;
    } catch {
      useAuthStore.getState().clearAuth();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Wrapper fetch avec injection automatique du Bearer token et
 * interceptor 401 → refresh (lock en vol) → retry.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  const headers = new Headers(init.headers);
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  // 401 → tente un refresh puis retry une seule fois.
  // On exclut seulement les routes d'auth qui ne doivent pas boucler (refresh, login, register, logout).
  const isAuthEndpoint = /\/api\/auth\/(refresh|login|register|logout)$/.test(path);
  if (res.status === 401 && !isAuthEndpoint) {
    const newToken = await refreshToken();
    if (newToken) {
      const retryHeaders = new Headers(init.headers);
      retryHeaders.set("Authorization", `Bearer ${newToken}`);
      const retryRes = await fetch(path, {
        ...init,
        headers: retryHeaders,
        credentials: "include",
        cache: "no-store",
      });
      return parseResponse<T>(retryRes);
    }
    // Refresh échoué → redirect login géré par le store.
    throw new ApiError(401, "Session expirée");
  }

  return parseResponse<T>(res);
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const errorBody = body as ApiErrorBody | null;
    // Le backend renvoie { error: { message, details } } — fallback sur la
    // shape plate { message, fieldErrors } pour compatibilité.
    const message = errorBody?.error?.message ?? errorBody?.message ?? "Erreur inconnue";
    const fieldErrors = errorBody?.error?.details ?? errorBody?.fieldErrors;
    throw new ApiError(res.status, message, fieldErrors);
  }

  return body as T;
}

/**
 * Fetch binaire (pour les pièces jointes) avec auth + refresh.
 * Retourne le blob directement.
 */
export async function apiFetchBlob(path: string): Promise<Blob> {
  const { accessToken } = useAuthStore.getState();

  const headers = new Headers();
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  let res = await fetch(path, { headers, credentials: "include", cache: "no-store" });

  const isAuthEndpoint = /\/api\/auth\/(refresh|login|register|logout)$/.test(path);
  if (res.status === 401 && !isAuthEndpoint) {
    const newToken = await refreshToken();
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      res = await fetch(path, { headers, credentials: "include", cache: "no-store" });
    }
  }

  if (!res.ok) throw new ApiError(res.status, "Téléchargement échoué");
  return res.blob();
}
