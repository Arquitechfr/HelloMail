import { offlineDb, type MutationType } from "./db";
import { queueOfflineMutation } from "./offlineQueueService";
import { apiFetch } from "@/lib/api";
import type { Message, MessageDetail, PaginatedResponse } from "@/lib/api-types";

/**
 * Exécute la requête de liste de messages avec mise en cache locale et repli hors-ligne.
 */
export async function fetchMessagesWithOfflineFallback(
  accountId: string,
  folder: string,
  url: string,
): Promise<PaginatedResponse<Message>> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const cached = await offlineDb.getMessages(accountId, folder);
    return {
      data: cached,
      page: 1,
      limit: Math.max(cached.length, 50),
      total: cached.length,
    };
  }

  try {
    const response = await apiFetch<PaginatedResponse<Message>>(url);
    if (response?.data && response.data.length > 0) {
      // Sauvegarde asynchrone non bloquante en cache IndexedDB
      offlineDb.saveMessages(accountId, folder, response.data).catch((err) => {
        console.debug("[OfflineCache] Échec sauvegarde messages:", err);
      });
    }
    return response;
  } catch (error) {
    // Si la requête échoue en raison du réseau, repli sur le cache local
    const cached = await offlineDb.getMessages(accountId, folder);
    if (cached.length > 0) {
      return {
        data: cached,
        page: 1,
        limit: Math.max(cached.length, 50),
        total: cached.length,
      };
    }
    throw error;
  }
}

/**
 * Exécute la requête de détail d'un message avec mise en cache locale et repli hors-ligne.
 */
export async function fetchDetailWithOfflineFallback(
  accountId: string,
  folder: string,
  uid: number,
  onlineFetch: () => Promise<MessageDetail>,
): Promise<MessageDetail> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const cached = await offlineDb.getMessageDetail(accountId, folder, uid);
    if (cached) return cached;
    throw new Error("Message non disponible hors-ligne");
  }

  try {
    const detail = await onlineFetch();
    offlineDb.saveMessageDetail(accountId, folder, uid, detail).catch((err) => {
      console.debug("[OfflineCache] Échec sauvegarde détail:", err);
    });
    return detail;
  } catch (error) {
    const cached = await offlineDb.getMessageDetail(accountId, folder, uid);
    if (cached) return cached;
    throw error;
  }
}

/**
 * Exécute une mutation ou l'ajoute à la file hors-ligne si le réseau est indisponible.
 */
export async function executeOrQueueOffline<T>(
  type: MutationType,
  accountId: string,
  folder: string,
  uid: number,
  payload: Record<string, unknown> | undefined,
  onlineCall: () => Promise<T>,
): Promise<T | void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await queueOfflineMutation(type, accountId, folder, uid, payload);
    return;
  }

  try {
    return await onlineCall();
  } catch (error) {
    // En cas de coupure réseau soudaine, mise en file d'attente automatique
    const isNetworkError =
      error instanceof TypeError ||
      (error instanceof Error &&
        (error.message.includes("network") ||
          error.message.includes("fetch") ||
          error.message.includes("Failed to fetch")));

    if (isNetworkError) {
      console.info(`[OfflineQueue] Bascule automatique hors-ligne pour la mutation ${type}`);
      await queueOfflineMutation(type, accountId, folder, uid, payload);
      return;
    }
    throw error;
  }
}
