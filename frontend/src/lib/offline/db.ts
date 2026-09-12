import type { Message, MessageDetail } from "@/lib/api-types";

export type MutationType =
  | "UPDATE_FLAGS"
  | "PIN_MESSAGE"
  | "DELETE_MESSAGE"
  | "MOVE_MESSAGE"
  | "MARK_JUNK";

export interface PendingMutation {
  id?: number;
  type: MutationType;
  accountId: string;
  folder: string;
  uid: number;
  payload?: Record<string, unknown>;
  createdAt: number;
  attempts?: number;
}

export interface OfflineDatabase {
  saveMessages(accountId: string, folder: string, messages: Message[]): Promise<void>;
  getMessages(accountId: string, folder: string): Promise<Message[]>;
  saveMessageDetail(accountId: string, folder: string, uid: number, detail: MessageDetail): Promise<void>;
  getMessageDetail(accountId: string, folder: string, uid: number): Promise<MessageDetail | null>;
  updateMessageFlagsLocally(accountId: string, folder: string, uid: number, flags: Partial<Message["flags"]>): Promise<void>;
  updateMessagePinLocally(accountId: string, folder: string, uid: number, isPinned: boolean): Promise<void>;
  deleteMessageLocally(accountId: string, folder: string, uid: number): Promise<void>;
  addPendingMutation(mutation: Omit<PendingMutation, "id" | "createdAt">): Promise<number>;
  getPendingMutations(): Promise<PendingMutation[]>;
  removePendingMutation(id: number): Promise<void>;
  clearPendingMutations(): Promise<void>;
}

const DB_NAME = "hellomail_offline_db";
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
      const record = {
        ...msg,
        id: `${accountId}:${folder}:${msg.uid}`,
        cachedAt: Date.now(),
      };
      store.put(record);
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
        // Trier localement : isPinned d'abord, puis date descendante
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
    const record = {
      ...detail,
      id: `${accountId}:${folder}:${uid}`,
      cachedAt: Date.now(),
    };
    store.put(record);

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
    const key = `${accountId}:${folder}:${uid}`;
    const getReq = store.get(key);

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
    const key = `${accountId}:${folder}:${uid}`;
    const getReq = store.get(key);

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
    const store = tx.objectStore("messages");
    store.delete(`${accountId}:${folder}:${uid}`);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async addPendingMutation(mutation: Omit<PendingMutation, "id" | "createdAt">): Promise<number> {
    const db = await this.getDB();
    const tx = db.transaction("pending_mutations", "readwrite");
    const store = tx.objectStore("pending_mutations");
    const record: PendingMutation = {
      ...mutation,
      createdAt: Date.now(),
      attempts: 0,
    };
    const request = store.add(record);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingMutations(): Promise<PendingMutation[]> {
    const db = await this.getDB();
    const tx = db.transaction("pending_mutations", "readonly");
    const store = tx.objectStore("pending_mutations");
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as PendingMutation[]) || []);
      request.onerror = () => reject(request.error);
    });
  }

  async removePendingMutation(id: number): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction("pending_mutations", "readwrite");
    const store = tx.objectStore("pending_mutations");
    store.delete(id);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearPendingMutations(): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction("pending_mutations", "readwrite");
    const store = tx.objectStore("pending_mutations");
    store.clear();

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

/**
 * Implémentation en mémoire pour le SSR, Node.js et les tests unitaires.
 */
export class InMemoryOfflineDb implements OfflineDatabase {
  private messages = new Map<string, Message>();
  private details = new Map<string, MessageDetail>();
  private mutations: PendingMutation[] = [];
  private nextMutationId = 1;

  async saveMessages(accountId: string, folder: string, messages: Message[]): Promise<void> {
    for (const msg of messages) {
      this.messages.set(`${accountId}:${folder}:${msg.uid}`, { ...msg });
    }
  }

  async getMessages(accountId: string, folder: string): Promise<Message[]> {
    const results: Message[] = [];
    const prefix = `${accountId}:${folder}:`;
    for (const [key, val] of this.messages.entries()) {
      if (key.startsWith(prefix)) {
        results.push({ ...val });
      }
    }
    results.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    return results;
  }

  async saveMessageDetail(accountId: string, folder: string, uid: number, detail: MessageDetail): Promise<void> {
    this.details.set(`${accountId}:${folder}:${uid}`, { ...detail });
  }

  async getMessageDetail(accountId: string, folder: string, uid: number): Promise<MessageDetail | null> {
    const d = this.details.get(`${accountId}:${folder}:${uid}`);
    return d ? { ...d } : null;
  }

  async updateMessageFlagsLocally(accountId: string, folder: string, uid: number, flags: Partial<Message["flags"]>): Promise<void> {
    const key = `${accountId}:${folder}:${uid}`;
    const current = this.messages.get(key);
    if (current) {
      current.flags = { ...current.flags, ...flags };
      this.messages.set(key, current);
    }
  }

  async updateMessagePinLocally(accountId: string, folder: string, uid: number, isPinned: boolean): Promise<void> {
    const key = `${accountId}:${folder}:${uid}`;
    const current = this.messages.get(key);
    if (current) {
      current.isPinned = isPinned;
      this.messages.set(key, current);
    }
  }

  async deleteMessageLocally(accountId: string, folder: string, uid: number): Promise<void> {
    this.messages.delete(`${accountId}:${folder}:${uid}`);
  }

  async addPendingMutation(mutation: Omit<PendingMutation, "id" | "createdAt">): Promise<number> {
    const id = this.nextMutationId++;
    this.mutations.push({
      ...mutation,
      id,
      createdAt: Date.now(),
      attempts: 0,
    });
    return id;
  }

  async getPendingMutations(): Promise<PendingMutation[]> {
    return [...this.mutations];
  }

  async removePendingMutation(id: number): Promise<void> {
    this.mutations = this.mutations.filter((m) => m.id !== id);
  }

  async clearPendingMutations(): Promise<void> {
    this.mutations = [];
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
