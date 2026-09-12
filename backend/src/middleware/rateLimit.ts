import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import Redis from 'ioredis';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import {
  RATE_LIMIT_AUTH_WINDOW_MS,
  RATE_LIMIT_AUTH_MAX,
  RATE_LIMIT_GLOBAL_WINDOW_MS,
  RATE_LIMIT_GLOBAL_MAX,
  SEND_RATE_LIMIT_WINDOW_MS,
  SEND_RATE_LIMIT_MAX,
} from '../config/constants.js';

/** Bypass commun pour tous les limiters en mode test. */
const skipInTest = (): boolean => env.NODE_ENV === 'test';

/**
 * Routes exemptées du rate limit global : sondes techniques et connexion SSE
 * longue durée (les reconnexions EventSource ne doivent pas consommer le quota).
 * `path` est relatif au point de montage `/api`.
 */
const GLOBAL_LIMIT_EXEMPT_PATHS = new Set(['/health', '/metrics', '/events']);

/** Prédicat pur : true si le path (relatif à /api) est exempté du rate limit global. */
export const isGlobalExemptPath = (path: string): boolean =>
  GLOBAL_LIMIT_EXEMPT_PATHS.has(path);

const skipGlobalExempt = (req: Request): boolean =>
  skipInTest() || isGlobalExemptPath(req.path);

let redisRateLimitClient: Redis | null = null;

/**
 * Crée ou réutilise le store Redis pour le partage distribué des limites.
 * Retourne undefined en test pour utiliser le MemoryStore sans dépendance Redis.
 */
function getRedisStore(prefix: string) {
  if (env.NODE_ENV === 'test') {
    return undefined;
  }

  if (!redisRateLimitClient) {
    redisRateLimitClient = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => Math.min(times * 500, 2000),
    });

    redisRateLimitClient.on('error', (err) => {
      logger.error({ err: err.message }, 'Erreur Redis rate limit');
    });
  }

  return new RedisStore({
    sendCommand: (command: string, ...args: (string | number)[]) =>
      redisRateLimitClient!.call(command, ...args) as Promise<RedisReply>,
    prefix: `rl:${prefix}:`,
  });
}

/** Handler commun : lève une AppError tooManyRequests au lieu de la réponse par défaut. */
export function createHandler(windowMs: number, message?: string) {
  return (req: Request, res: Response, next: NextFunction, _options: unknown): void => {
    const retryAfter = Math.ceil(windowMs / 1000);
    res.set('Retry-After', String(retryAfter));
    next(message ? AppError.tooManyRequests(message) : AppError.tooManyRequests());
  };
}

/**
 * Rate limit global sur toute l'API — 300 req/min/IP par défaut en production
 * (surchargeable via RATE_LIMIT_GLOBAL_MAX / RATE_LIMIT_GLOBAL_WINDOW_MS).
 * Exempte /api/health, /api/metrics et /api/events (sondes + SSE).
 * Utilise RedisStore pour supporter le clustering multi-instances.
 */
export const globalRateLimit = rateLimit({
  windowMs: RATE_LIMIT_GLOBAL_WINDOW_MS,
  max: RATE_LIMIT_GLOBAL_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  skip: skipGlobalExempt,
  store: getRedisStore('global'),
  handler: createHandler(RATE_LIMIT_GLOBAL_WINDOW_MS) as never,
});

/**
 * Rate limit sur les routes d'auth sensibles (login, register) — 10 req/15 min/IP.
 */
export const authRateLimit = rateLimit({
  windowMs: RATE_LIMIT_AUTH_WINDOW_MS,
  max: RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  skip: skipInTest,
  store: getRedisStore('auth'),
  handler: createHandler(RATE_LIMIT_AUTH_WINDOW_MS) as never,
});

/**
 * Rate limit sur l'envoi d'emails (anti-spam) — 20 req/min/IP.
 */
export const sendRateLimit = rateLimit({
  windowMs: SEND_RATE_LIMIT_WINDOW_MS,
  max: SEND_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  skip: skipInTest,
  store: getRedisStore('send'),
  handler: createHandler(SEND_RATE_LIMIT_WINDOW_MS, 'Trop d\'envois, réessayez dans quelques minutes') as never,
});
