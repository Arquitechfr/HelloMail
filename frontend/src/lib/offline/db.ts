import type { Message, MessageDetail } from "@/lib/api-types";
import type {
  MutationType,
  PendingMutation,
  OfflineDatabase,
  PruneResult,
} from "./types";
import { InMemoryOfflineDb } from "./inMemoryDb";

export type { MutationType, PendingMutation, OfflineDatabase, PruneResult };
export { InMemoryOfflineDb };

const DB_NAME = "mailora_offline_db";
const DB_VERSION = 1;

/**
 * Implémentation IndexedDB native du navigateur avec Promises.
 */
class BrowserIndexedDb implements OfflineDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof window === "undefined" || !window.indexedDB) {
        reject(new Error("IndexedDB non disponible"));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains("messages")) {
          const msgStore = db.createObjectStore("messages", { keyPath: "id" });
          msgStore.createIndex("byAccountFolder", ["accountId", "folder"], { unique: false });
        }

        if (!db.objectStoreNames.contains("message_details")) {
          db.createObjectStore("message_details", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains("pending_mutations")) {
          db.createObjectStore("pending_mutations", { keyPath: "id", autoIncrement: true });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  async saveMessages(accountId: string, folder: string, messages: Message[]): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");

    for (const msg of messages) {
      store.put({
        ...msg,
        id: `${accountId}:${folder}:${msg.uid}`,
        cachedAt: Date.now(),
      });
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMessages(accountId: string, folder: string): Promise<Message[]> {
    const db = await this.getDB();
    const tx = db.transaction("messages", "readonly");
    const store = tx.objectStore("messages");
    const index = store.index("byAccountFolder");
    const request = index.getAll(IDBKeyRange.only([accountId, folder]));

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const results = (request.result as (Message & { id: string })[]) || [];
        results.sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveMessageDetail(accountId: string, folder: string, uid: number, detail: MessageDetail): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction("message_details", "readwrite");
    const store = tx.objectStore("message_details");
    store.put({
      ...detail,
      id: `${accountId}:${folder}:${uid}`,
      cachedAt: Date.now(),
    });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMessageDetail(accountId: string, folder: string, uid: number): Promise<MessageDetail | null> {
    const db = await this.getDB();
    const tx = db.transaction("message_details", "readonly");
    const store = tx.objectStore("message_details");
    const request = store.get(`${accountId}:${folder}:${uid}`);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as MessageDetail) || null);
      request.onerror = () => reject(request.error);
    });
  }

  async updateMessageFlagsLocally(accountId: string, folder: string, uid: number, flags: Partial<Message["flags"]>): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    const getReq = store.get(`${accountId}:${folder}:${uid}`);

    return new Promise((resolve, reject) => {
      getReq.onsuccess = () => {
        const current = getReq.result as (Message & { id: string }) | undefined;
        if (current) {
          current.flags = { ...current.flags, ...flags };
          store.put(current);
        }
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async updateMessagePinLocally(accountId: string, folder: string, uid: number, isPinned: boolean): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    const getReq = store.get(`${accountId}:${folder}:${uid}`);

    return new Promise((resolve, reject) => {
      getReq.onsuccess = () => {
        const current = getReq.result as (Message & { id: string }) | undefined;
        if (current) {
          current.isPinned = isPinned;
          store.put(current);
        }
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async deleteMessageLocally(accountId: string, folder: string, uid: number): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction("messages", "readwrite");
    tx.objectStore("messages").delete(`${accountId}:${folder}:${uid}`);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async addPendingMutation(mutation: Omit<PendingMutation, "id" | "createdAt">): Promise<number> {
    const db = await this.getDB();
    const tx = db.transaction("pending_mutations", "readwrite");
    const request = tx.objectStore("pending_mutations").add({
      ...mutation,
      createdAt: Date.now(),
      attempts: 0,
    });

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingMutations(): Promise<PendingMutation[]> {
    const db = await this.getDB();
    const tx = db.transaction("pending_mutations", "readonly");
    const request = tx.objectStore("pending_mutations").getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as PendingMutation[]) || []);
      request.onerror = () => reject(request.error);
    });
  }

  async removePendingMutation(id: number): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction("pending_mutations", "readwrite");
    tx.objectStore("pending_mutations").delete(id);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearPendingMutations(): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction("pending_mutations", "readwrite");
    tx.objectStore("pending_mutations").clear();

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async pruneOldCache(maxMessagesPerFolder = 500, maxDetailAgeDays = 30): Promise<PruneResult> {
    const db = await this.getDB();
    let prunedDetails = 0;
    let prunedMessages = 0;

    // 1. Purge des détails de messages expirés (TTL)
    const cutoff = Date.now() - maxDetailAgeDays * 24 * 60 * 60 * 1000;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("message_details", "readwrite");
      const store = tx.objectStore("message_details");
      const request = store.openCursor();

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const val = cursor.value as { cachedAt?: number };
          if (val.cachedAt && val.cachedAt < cutoff) {
            cursor.delete();
            prunedDetails++;
          }
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // 2. Plafonnement du nombre de messages par dossier (LRU)
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("messages", "readwrite");
      const store = tx.objectStore("messages");
      const request = store.getAll();

      request.onsuccess = () => {
        const messages = (request.result as (Message & { id: string; cachedAt?: number })[]) || [];
        const groups = new Map<string, (Message & { id: string })[]>();

        for (const msg of messages) {
          const key = `${msg.accountId}:${msg.folder}`;
          const list = groups.get(key) || [];
          list.push(msg);
          groups.set(key, list);
        }

        for (const list of groups.values()) {
          if (list.length > maxMessagesPerFolder) {
            list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const excess = list.slice(maxMessagesPerFolder);
            for (const item of excess) {
              store.delete(item.id);
              prunedMessages++;
            }
          }
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return { prunedMessages, prunedDetails };
  }
}

/**
 * Instance exportée par défaut : utilise IndexedDB dans le navigateur si disponible,
 * avec repli automatique en mémoire côté serveur ou en environnement restreint.
 */
export const offlineDb: OfflineDatabase =
  typeof window !== "undefined" && Boolean(window.indexedDB)
    ? new BrowserIndexedDb()
    : new InMemoryOfflineDb();
