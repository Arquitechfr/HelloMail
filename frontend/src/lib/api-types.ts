/**
 * Types API — miroir des types backend Mailora.
 * Source : backend/src/models/ + backend/src/services/email/ + backend/src/services/realtime/
 */

// --- Auth ---

export type UnifiedFolderType =
  | "inbox"
  | "starred"
  | "pinned"
  | "drafts"
  | "sent"
  | "snoozed"
  | "archive"
  | "junk"
  | "trash";

export interface UnifiedFolderConfig {
  id: UnifiedFolderType;
  label?: string;
  enabled: boolean;
  order: number;
}

export type UnifiedStatusResponse = Record<
  UnifiedFolderType,
  { unseen: number; total: number }
>;

export interface UserPreferences {
  undoSendDelay?: number; // 0 (immédiat), 5, 10, 15, 30 secondes
  autoAddContacts?: boolean; // ajout auto des expéditeurs au carnet d'adresses
  unifiedFoldersEnabled?: boolean;
  unifiedFolders?: UnifiedFolderConfig[];
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

export interface ContactImportResult {
  imported: number;
  skipped: number;
  total: number;
}


// --- Comptes ---

export type AccountProvider = "imap" | "google_oauth" | "microsoft_oauth";

export interface SignatureVariables {
  phone?: string;
  jobTitle?: string;
  company?: string;
}

export interface SignatureConfig {
  enabled: boolean;
  text: string;
  html?: string;
  variables?: SignatureVariables;
}

export interface AccountAlias {
  _id: string;
  name?: string;
  email: string;
  isDefault: boolean;
  signature?: SignatureConfig;
  createdAt?: string;
}

export interface Account {
  _id: string;
  provider: AccountProvider;
  emailAddress: string;
  displayName?: string;
  aliases?: AccountAlias[];
  signature?: SignatureConfig;
  color?: string;
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
  isPinned?: boolean;
  pinnedAt?: string | null;
  followUpStatus?: 'pending' | 'triggered' | 'replied' | 'dismissed' | null;
  followUpRemindAt?: string | null;
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

export interface CalendarAttendee {
  name?: string;
  email: string;
  role?: string;
  status?: string;
}

export interface CalendarEventInfo {
  uid?: string;
  method?: string;
  summary: string;
  description?: string;
  location?: string;
  dtStart?: string;
  dtEnd?: string;
  organizer?: { name?: string; email: string };
  status?: string;
  attendees?: CalendarAttendee[];
  sequence?: number;
  rawIcs?: string;
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
  readReceiptSentAt?: string | null;
  tags?: string[];
  snoozedUntil?: string | null;
  isPinned?: boolean;
  pinnedAt?: string | null;
  followUpStatus?: 'pending' | 'triggered' | 'replied' | 'dismissed' | null;
  followUpRemindAt?: string | null;
  calendarEvent?: CalendarEventInfo;
  unsubscribeInfo?: UnsubscribeInfo;
  securitySummary?: EmailSecuritySummary;
}

export type SecurityVerdict = 'pass' | 'fail' | 'neutral' | 'unknown';

export interface EmailSecuritySummary {
  spf: SecurityVerdict;
  dkim: SecurityVerdict;
  dmarc: SecurityVerdict;
  isTrusted: boolean;
  warningMessage?: string;
  spamScore?: number;
  isSpam?: boolean;
  details?: {
    authResultsRaw?: string;
    spfDetails?: string;
    dkimDetails?: string;
    dmarcDetails?: string;
  };
}

export interface UnsubscribeInfo {
  httpUrl?: string;
  mailto?: string;
  isOneClick: boolean;
}

export interface UnsubscribeResult {
  success: boolean;
  action: 'one_click' | 'mailto' | 'open_url';
  url?: string;
  details: string;
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

export interface SendEmailAttachment {
  filename: string;
  content: string;
  contentType?: string;
}

export interface SendEmailInput {
  from?: {
    name?: string;
    address: string;
  };
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: SendEmailAttachment[];
  inReplyTo?: string;
  references?: string[];
  requestReadReceipt?: boolean;
  followUpReminder?: {
    remindAt: string;
    note?: string;
  };
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
  | "markAsJunk"
  | "pin"
  | "unpin";

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
  attachments?: SendEmailAttachment[];
  inReplyTo?: string;
  references?: string[];
}

export interface DraftResult {
  ok: boolean;
  uid?: number;
}

// --- Emails programmés (Send Later) ---

export type ScheduledStatus = "pending" | "processing" | "sent" | "failed" | "cancelled";

export interface ScheduledMessage {
  id: string;
  _id?: string;
  userId: string;
  accountId: string;
  payload: SendEmailInput;
  scheduledAt: string;
  status: ScheduledStatus;
  attempts: number;
  sentAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleEmailInput extends SendEmailInput {
  scheduledAt: string;
}

// --- Temps réel (SSE) ---

export type RealtimeEventType =
  | "message:new"
  | "message:deleted"
  | "message:flags"
  | "account:syncError"
  | "scheduled:sent"
  | "reminder:triggered"
  | "reminder:resolved";

export interface RealtimeEvent {
  type: RealtimeEventType;
  accountId: string;
  userId: string;
  payload: unknown;
}

// --- Erreurs API ---

export interface ApiErrorBody {
  error?: {
    message: string;
    details?: Record<string, string[]>;
  };
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

// --- Règles de tri automatique ---
export * from "./types/rules";

// --- Libellés / Étiquettes (Tags) ---
export * from "./types/tags";

// --- Chiffrement OpenPGP ---
export interface PgpKeyInfo {
  _id?: string;
  email: string;
  name?: string;
  armoredPublicKey: string;
  armoredPrivateKey?: string;
  fingerprint: string;
  keyId: string;
  algorithm: string;
  isOwnKey: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContactPublicKeyInfo {
  email: string;
  name?: string;
  armoredPublicKey: string;
  fingerprint: string;
  keyId: string;
}

// --- Listes Blanches & Noires (Allowlist / Denylist) ---
export type SenderListType = 'allow' | 'deny';

export interface SenderListEntry {
  _id: string;
  userId: string;
  type: SenderListType;
  target: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Dossiers Virtuels Intelligents (Smart Folders) ---
export interface SmartFolder {
  _id: string;
  userId: string;
  name: string;
  icon?: string;
  color?: string;
  query: string;
  accountId?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface SmartFolderCount {
  total: number;
  unread: number;
}

export interface SmartFolderMessagesResponse {
  data: Message[];
  page: number;
  limit: number;
  total: number;
  smartFolder: SmartFolder;
}

export interface CreateSmartFolderInput {
  name: string;
  icon?: string;
  color?: string;
  query: string;
  accountId?: string;
  order?: number;
}

export interface UpdateSmartFolderInput {
  name?: string;
  icon?: string;
  color?: string;
  query?: string;
  accountId?: string | null;
  order?: number;
}

