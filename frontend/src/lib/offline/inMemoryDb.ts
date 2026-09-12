import type { Message, MessageDetail } from "@/lib/api-types";
import type {
  PendingMutation,
  OfflineDatabase,
  PruneResult,
} from "./types";

/**
 * Implémentation en mémoire pour le SSR, Node.js et les tests unitaires.
 */
export class InMemoryOfflineDb implements OfflineDatabase {
  private messages = new Map<string, Message & { cachedAt?: number }>();
  private details = new Map<string, MessageDetail & { cachedAt?: number }>();
  private mutations: PendingMutation[] = [];
  private nextMutationId = 1;

  async saveMessages(accountId: string, folder: string, messages: Message[]): Promise<void> {
    const now = Date.now();
    for (const msg of messages) {
      this.messages.set(`${accountId}:${folder}:${msg.uid}`, { ...msg, cachedAt: now });
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
    this.details.set(`${accountId}:${folder}:${uid}`, { ...detail, cachedAt: Date.now() });
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

  async pruneOldCache(maxMessagesPerFolder = 500, maxDetailAgeDays = 30): Promise<PruneResult> {
    let prunedDetails = 0;
    let prunedMessages = 0;
    const cutoff = Date.now() - maxDetailAgeDays * 24 * 60 * 60 * 1000;

    // 1. Purge des détails expirés (TTL)
    for (const [key, detail] of this.details.entries()) {
      if (detail.cachedAt && detail.cachedAt < cutoff) {
        this.details.delete(key);
        prunedDetails++;
      }
    }

    // 2. Plafonnement des messages par dossier (LRU)
    const groups = new Map<string, { key: string; msg: Message }[]>();
    for (const [key, msg] of this.messages.entries()) {
      const parts = key.split(":");
      const groupKey = `${parts[0]}:${parts[1]}`;
      const list = groups.get(groupKey) || [];
      list.push({ key, msg });
      groups.set(groupKey, list);
    }

    for (const list of groups.values()) {
      if (list.length > maxMessagesPerFolder) {
        list.sort((a, b) => new Date(b.msg.date).getTime() - new Date(a.msg.date).getTime());
        const excess = list.slice(maxMessagesPerFolder);
        for (const item of excess) {
          this.messages.delete(item.key);
          prunedMessages++;
        }
      }
    }

    return { prunedMessages, prunedDetails };
  }
}
