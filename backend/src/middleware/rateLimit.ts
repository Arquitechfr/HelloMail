import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';
import { RATE_LIMIT_AUTH_WINDOW_MS, RATE_LIMIT_AUTH_MAX } from '../config/constants.js';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Rate limiting in-memory sur les routes d'auth sensibles (login, register).
 * - Fenêtre glissante de 15 min, max 10 requêtes par IP.
 * - Stockage Map en mémoire (ne survit pas à un restart, pas de partage multi-instance).
 * - Bypass total en mode test.
 *
 * Dépend de `app.set('trust proxy', 1)` en production pour que req.ip
 * reflète l'IP réelle du client derrière le reverse proxy.
 * Dette technique : migrer vers Redis si scaling horizontal.
 */
export function authRateLimit(req: Request, res: Response, next: NextFunction): void {
  if (env.NODE_ENV === 'test') {
    next();
    return;
  }

  const key = `auth:${req.ip || 'unknown'}`;
  const now = Date.now();

  // Cleanup des entrées expirées
  for (const [k, entry] of store) {
    if (entry.resetTime < now) {
      store.delete(k);
    }
  }

  const entry = store.get(key);

  if (!entry) {
    store.set(key, { count: 1, resetTime: now + RATE_LIMIT_AUTH_WINDOW_MS });
    next();
    return;
  }

  if (entry.resetTime < now) {
    store.set(key, { count: 1, resetTime: now + RATE_LIMIT_AUTH_WINDOW_MS });
    next();
    return;
  }

  entry.count++;

  if (entry.count > RATE_LIMIT_AUTH_MAX) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    next(AppError.tooManyRequests());
    return;
  }

  next();
}
