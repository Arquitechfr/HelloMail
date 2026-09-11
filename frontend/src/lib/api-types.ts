/**
 * Types API — miroir des types backend HelloMail.
 * Source : backend/src/models/ + backend/src/services/email/ + backend/src/services/realtime/
 */

// --- Auth ---

export interface UserPreferences {
  undoSendDelay?: number; // 0 (immédiat), 5, 10, 15, 30 secondes
  autoAddContacts?: boolean; // ajout auto des expéditeurs au carnet d'adresses
}

export interface User {
  id: string;
  email: string;
  preferences?: UserPreferences;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

// --- 2FA ---

export interface LoginResponse {
  requiresTwoFactor?: boolean;
  twoFactorTempToken?: string;
  accessToken?: string;
  user?: User;
}

export interface TwoFAStatus {
  twoFactorEnabled: boolean;
  webauthnCredentialsCount: number;
}

export interface TOTPSetupResponse {
  qrCodeUrl: string;
  secret: string;
}

export interface EnableTOTPResponse {
  backupCodes: string[];
}

// --- Contacts ---

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Comptes ---

export type AccountProvider = "imap" | "google_oauth" | "microsoft_oauth";

export interface Account {
  _id: string;
  provider: AccountProvider;
  emailAddress: string;
  displayName?: string;
  signature?: {
    enabled: boolean;
    text: string;
    html?: string;
  };
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
  inReplyTo?: string;
  subject: string;
  from: MessageAddress;
  to: MessageAddress[];
  date: string;
  flags: MessageFlags;
  hasAttachments: boolean;
  size: number;
  tags?: string[];
  snoozedUntil?: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  /** 'local' = base MongoDB, 'server' = résultats enrichis via recherche IMAP. */
  source?: "local" | "server";
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
  inReplyTo?: string;
  headers: Record<string, string>;
  text?: string;
  html?: string;
  flags: MessageFlags;
  size: number;
  attachments: AttachmentInfo[];
  readReceiptRequestedTo?: string;
  tags?: string[];
  snoozedUntil?: string | null;
}

export interface ThreadItem {
  uid: number;
  folder: string;
  messageId?: string;
  inReplyTo?: string;
  subject: string;
  from: MessageAddress;
  to: MessageAddress[];
  date: string;
  flags: MessageFlags;
  hasAttachments: boolean;
  size: number;
}

export interface ThreadResponse {
  conversationSubject: string;
  count: number;
  messages: ThreadItem[];
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
  requestReadReceipt?: boolean;
}

export interface SendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

// --- Pagination arrière ---

export interface FetchMoreResult {
  fetched: number;
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

// --- Règles de tri automatique ---
export * from "./types/rules";

// --- Libellés / Étiquettes (Tags) ---
export * from "./types/tags";

