import { env } from './env.js';

export const COOKIE_REFRESH_TOKEN = 'hellomail_refresh';

export const JWT_ACCESS_EXPIRES_IN = env.JWT_ACCESS_EXPIRES_IN;
export const JWT_REFRESH_EXPIRES_IN_DAYS = env.JWT_REFRESH_EXPIRES_IN_DAYS;

export const RATE_LIMIT_AUTH_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_AUTH_MAX = 10;

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
