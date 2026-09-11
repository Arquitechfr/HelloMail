import { env } from './env.js';

export const COOKIE_REFRESH_TOKEN = 'hellomail_refresh';

export const JWT_ACCESS_EXPIRES_IN = env.JWT_ACCESS_EXPIRES_IN;
export const JWT_REFRESH_EXPIRES_IN_DAYS = env.JWT_REFRESH_EXPIRES_IN_DAYS;

export const RATE_LIMIT_AUTH_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_AUTH_MAX = env.NODE_ENV === 'production' ? 10 : 100;

// --- Rate limit global (Phase 5) ---

/** Fenêtre du rate limit global (ms). */
export const RATE_LIMIT_GLOBAL_WINDOW_MS = env.RATE_LIMIT_GLOBAL_WINDOW_MS ?? 60_000;

/** Nombre max de requêtes par fenêtre par IP (global). */
export const RATE_LIMIT_GLOBAL_MAX =
  env.RATE_LIMIT_GLOBAL_MAX ?? (env.NODE_ENV === 'production' ? 300 : 1000);

// --- Sync worker (Phase 2) ---

/** Intervalle de polling des comptes actifs (ms). */
export const ACCOUNT_POLL_INTERVAL_MS = 30_000;

/** Échecs consécutifs avant désactivation automatique d'un compte. */
export const MAX_CONSECUTIVE_SYNC_FAILURES = 10;

/** Base du backoff exponentiel sur échec de connexion (ms). */
export const SYNC_BACKOFF_BASE_MS = 1_000;

/** Plafond du backoff exponentiel (ms). */
export const SYNC_BACKOFF_MAX_MS = 5 * 60 * 1000;

/** Nombre de messages synchronisés lors de la sync initiale par compte/dossier. */
export const INITIAL_SYNC_MESSAGE_COUNT = 50;

/** Délai de connexion stable avant reset du compteur d'échecs consécutifs (ms). */
export const STABLE_CONNECTION_RESET_MS = 3 * 60 * 1000;

// --- Polling multi-dossiers (Phase 6) ---

/** Intervalle de polling des dossiers spéciaux via la 2e connexion read-only (ms). */
export const POLLING_INTERVAL_MS = 60_000;

// --- Pool IMAP côté API (Phase 3) ---

/** Durée d'inactivité avant fermeture d'une connexion du pool (ms). */
export const IMAP_POOL_IDLE_TTL_MS = 5 * 60 * 1000;

// --- Envoi SMTP (Phase 3) ---

/** Timeout SMTP (connexion, greeting, socket) en ms. */
export const SMTP_TIMEOUT_MS = 30_000;

/** Fenêtre du rate limit sur l'envoi (ms). */
export const SEND_RATE_LIMIT_WINDOW_MS = 60_000;

/** Nombre max d'envois par fenêtre par IP. */
export const SEND_RATE_LIMIT_MAX = env.NODE_ENV === 'production' ? 20 : 200;

/** Taille maximale totale d'un message envoyé (bytes, avant base64). */
export const SEND_MAX_TOTAL_SIZE_BYTES = 25 * 1024 * 1024;
