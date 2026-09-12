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

export interface PruneResult {
  prunedMessages: number;
  prunedDetails: number;
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
  /**
   * Élagage automatique du cache local IndexedDB :
   * - Supprime les détails de messages expirés (TTL par défaut : 30 jours).
   * - Plafonne le nombre de messages stockés par dossier (défaut : 500 les plus récents).
   */
  pruneOldCache(maxMessagesPerFolder?: number, maxDetailAgeDays?: number): Promise<PruneResult>;
}
