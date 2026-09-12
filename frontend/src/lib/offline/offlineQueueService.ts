import { offlineDb, type PendingMutation, type MutationType } from "./db";
import { apiFetch } from "@/lib/api";
import { tabSyncHub } from "@/lib/sync/tabSyncHub";
import type {
  OfflineMutationAddedPayload,
  OfflineSyncCompletedPayload,
} from "@/lib/sync/tabSyncTypes";

export interface ReplayResult {
  total: number;
  applied: number;
  failed: number;
}

export type ApiCaller = (url: string, init?: RequestInit) => Promise<unknown>;

/**
 * Enregistre une action en attente dans la base locale et applique la modification
 * immédiatement dans le cache IndexedDB pour persister la modification visuelle.
 */
export async function queueOfflineMutation(
  type: MutationType,
  accountId: string,
  folder: string,
  uid: number,
  payload?: Record<string, unknown>,
): Promise<number> {
  const id = await offlineDb.addPendingMutation({
    type,
    accountId,
    folder,
    uid,
    payload,
  });

  // Mise à jour optimiste locale dans la base IndexedDB
  try {
    switch (type) {
      case "UPDATE_FLAGS":
        if (payload?.flags) {
          await offlineDb.updateMessageFlagsLocally(
            accountId,
            folder,
            uid,
            payload.flags as Record<string, boolean>,
          );
        }
        break;
      case "PIN_MESSAGE":
        if (typeof payload?.isPinned === "boolean") {
          await offlineDb.updateMessagePinLocally(accountId, folder, uid, payload.isPinned);
        }
        break;
      case "DELETE_MESSAGE":
        await offlineDb.deleteMessageLocally(accountId, folder, uid);
        break;
      default:
        break;
    }
  } catch (err) {
    console.warn("[OfflineQueue] Erreur lors de la mise à jour locale:", err);
  }

  tabSyncHub.broadcast<OfflineMutationAddedPayload>("offline:mutation_added", {
    mutation: {
      id,
      type,
      accountId,
      folder,
      uid,
      payload,
      createdAt: Date.now(),
    },
  });

  return id;
}

/**
 * Rejoue séquentiellement les mutations en attente vers l'API Mailora.
 */
export async function replayPendingMutations(
  caller: ApiCaller = apiFetch,
): Promise<ReplayResult> {
  const pending = await offlineDb.getPendingMutations();
  if (pending.length === 0) {
    return { total: 0, applied: 0, failed: 0 };
  }

  let applied = 0;
  let failed = 0;

  for (const mutation of pending) {
    if (!mutation.id) continue;

    try {
      await executeMutation(mutation, caller);
      await offlineDb.removePendingMutation(mutation.id);
      applied++;
    } catch (error) {
      // Si l'erreur est une erreur 4xx (ressource introuvable / conflit),
      // on retire la mutation de la file pour éviter de la rejouer indéfiniment
      const status = (error as { status?: number })?.status;
      if (status && status >= 400 && status < 500) {
        console.warn(`[OfflineQueue] Mutation ${mutation.id} rejetée (${status}), retrait de la file`);
        await offlineDb.removePendingMutation(mutation.id);
        failed++;
      } else {
        // Erreur réseau ou 5xx : interruption pour préserver l'ordre FIFO
        console.warn(`[OfflineQueue] Échec réseau lors du rejeu de la mutation ${mutation.id}, pause`);
        failed++;
        break;
      }
    }
  }

  if (applied > 0) {
    tabSyncHub.broadcast<OfflineSyncCompletedPayload>("offline:sync_completed", {
      appliedCount: applied,
    });
  }

  return { total: pending.length, applied, failed };
}

async function executeMutation(mutation: PendingMutation, caller: ApiCaller): Promise<void> {
  const { type, accountId, folder, uid, payload } = mutation;
  const encodedFolder = encodeURIComponent(folder);
  const basePath = `/api/accounts/${accountId}/messages/${encodedFolder}/${uid}`;

  switch (type) {
    case "UPDATE_FLAGS":
      await caller(`${basePath}/flags`, {
        method: "PATCH",
        body: JSON.stringify(payload?.flags ?? payload),
      });
      break;

    case "PIN_MESSAGE":
      await caller(`${basePath}/pin`, {
        method: "PATCH",
        body: JSON.stringify({ isPinned: payload?.isPinned }),
      });
      break;

    case "DELETE_MESSAGE":
      await caller(`${basePath}${payload?.permanent ? "?permanent=true" : ""}`, {
        method: "DELETE",
      });
      break;

    case "MOVE_MESSAGE":
      await caller(`${basePath}/move`, {
        method: "POST",
        body: JSON.stringify({ destination: payload?.destination }),
      });
      break;

    case "MARK_JUNK":
      await caller(`${basePath}/junk`, {
        method: "POST",
      });
      break;

    default:
      console.warn(`[OfflineQueue] Type de mutation inconnu : ${type}`);
  }
}
