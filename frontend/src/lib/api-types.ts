/**
 * Types API — miroir des types backend HelloMail.
 * Source : backend/src/models/ + backend/src/services/email/ + backend/src/services/realtime/
 */

// --- Auth ---

export interface User {
  id: string;
  email: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

// --- Comptes ---

export type AccountProvider = "imap" | "google_oauth" | "microsoft_oauth";

export interface Account {
  _id: string;
  provider: AccountProvider;
  emailAddress: string;
  displayName?: string;
  isActive: boolean;
  lastSyncedAt?: string;
  lastSyncError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateImapAccountInput {
  emailAddress: string;
  displayName?: string;
  imap: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
  };
}

// --- Dossiers ---

export interface FolderStatus {
  messages: number;
  unseen: number;
  uidNext: number;
}

export interface FolderInfo {
  path: string;
  name: string;
  delimiter: string;
  specialUse?: string;
  flags: string[];
  status?: FolderStatus;
}

// --- Messages ---

export interface MessageAddress {
  name?: string;
  address: string;
}

export interface MessageFlags {
  seen: boolean;
  answered: boolean;
  flagged: boolean;
}

export interface Message {
  _id: string;
  accountId: string;
  folder: string;
  uid: number;
  messageId?: string;
  subject: string;
  from: MessageAddress;
  to: MessageAddress[];
  date: string;
  flags: MessageFlags;
  hasAttachments: boolean;
  size: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

export interface AttachmentInfo {
  filename: string;
  contentType: string;
  size: number;
  part: string;
  disposition: "attachment" | "inline";
  contentId?: string;
}

export interface MessageDetail {
  subject: string;
  from: MessageAddress;
  to: MessageAddress[];
  cc?: MessageAddress[];
  date: string;
  messageId?: string;
  headers: Record<string, string>;
  text?: string;
  html?: string;
  flags: MessageFlags;
  size: number;
  attachments: AttachmentInfo[];
}

// --- Envoi ---

export interface SendEmailInput {
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: string; contentType?: string }[];
  inReplyTo?: string;
  references?: string[];
}

export interface SendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

// --- Flags / Actions ---

export interface FlagsUpdate {
  seen?: boolean;
  flagged?: boolean;
  answered?: boolean;
}

export type BatchActionType =
  | "delete"
  | "move"
  | "markRead"
  | "markUnread"
  | "flag"
  | "unflag"
  | "markAsJunk";

export interface BatchActionInput {
  uids: number[];
  action: BatchActionType;
  destination?: string;
  folder?: string;
}

// --- Brouillons ---

export interface DraftInput {
  to?: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  inReplyTo?: string;
  references?: string[];
}

export interface DraftResult {
  ok: boolean;
  uid?: number;
}

// --- Temps réel (SSE) ---

export type RealtimeEventType =
  | "message:new"
  | "message:deleted"
  | "message:flags"
  | "account:syncError";

export interface RealtimeEvent {
  type: RealtimeEventType;
  accountId: string;
  userId: string;
  payload: unknown;
}

// --- Erreurs API ---

export interface ApiErrorBody {
  message: string;
  fieldErrors?: Record<string, string[]>;
}
