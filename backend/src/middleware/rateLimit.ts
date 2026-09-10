import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';
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

/** Handler commun : lève une AppError tooManyRequests au lieu de la réponse par défaut. */
function createHandler(message?: string) {
  return (req: Request, res: Response, next: NextFunction, _options: unknown): void => {
    const retryAfter = Math.ceil(RATE_LIMIT_AUTH_WINDOW_MS / 1000);
    res.set('Retry-After', String(retryAfter));
    next(message ? AppError.tooManyRequests(message) : AppError.tooManyRequests());
  };
}

/**
 * Rate limit global sur toute l'API — 100 req/15 min/IP.
 * Headers RateLimit-* (draft-7). Bypass en mode test.
 *
 * Dépend de `app.set('trust proxy', 1)` en production pour que req.ip
 * reflète l'IP réelle du client derrière le reverse proxy.
 * Dette technique : store in-memory (Map) — migrer vers Redis si scaling horizontal.
 */
export const globalRateLimit = rateLimit({
  windowMs: RATE_LIMIT_GLOBAL_WINDOW_MS,
  max: RATE_LIMIT_GLOBAL_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: createHandler() as never,
});

/**
 * Rate limit sur les routes d'auth sensibles (login, register) — 10 req/15 min/IP.
 * Bypass en mode test.
 */
export const authRateLimit = rateLimit({
  windowMs: RATE_LIMIT_AUTH_WINDOW_MS,
  max: RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: createHandler() as never,
});

/**
 * Rate limit sur l'envoi d'emails (anti-spam) — 20 req/min/IP.
 * Bypass en mode test.
 */
export const sendRateLimit = rateLimit({
  windowMs: SEND_RATE_LIMIT_WINDOW_MS,
  max: SEND_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: createHandler('Trop d\'envois, réessayez dans quelques minutes') as never,
});
