import type { User, RealtimeEvent } from "@/lib/api-types";
import type { PendingMutation } from "@/lib/offline/types";

/**
 * Types de messages inter-onglets échangés sur le BroadcastChannel.
 */
export type TabSyncMessageType =
  | "auth:login"
  | "auth:logout"
  | "auth:token_refreshed"
  | "sse:event"
  | "leader:heartbeat"
  | "leader:claim"
  | "leader:resigned"
  | "offline:mutation_added"
  | "offline:sync_completed"
  | "action:message_updated"
  | "action:message_deleted";

export interface TabSyncEnvelope<T = unknown> {
  type: TabSyncMessageType;
  senderTabId: string;
  timestamp: number;
  payload: T;
}

export interface AuthLoginPayload {
  accessToken: string;
  user: User;
}

export interface AuthTokenRefreshedPayload {
  accessToken: string;
  user?: User;
}

export interface SseEventPayload {
  event: RealtimeEvent;
  userId?: string;
}

export interface LeaderHeartbeatPayload {
  leaderTabId: string;
  timestamp: number;
}

export interface LeaderClaimPayload {
  candidateTabId: string;
}

export interface LeaderResignedPayload {
  resigningTabId: string;
}

export interface OfflineMutationAddedPayload {
  mutation: PendingMutation;
}

export interface OfflineSyncCompletedPayload {
  appliedCount: number;
}

export interface ActionMessageUpdatedPayload {
  accountId: string;
  folder: string;
  uid: number;
  flags?: Record<string, boolean>;
  isPinned?: boolean;
}

export interface ActionMessageDeletedPayload {
  accountId: string;
  folder: string;
  uid: number;
}
