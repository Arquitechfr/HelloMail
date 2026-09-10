import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export interface AuthenticatedRequest extends Request {
  user: { id: string };
}

declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

/**
 * Middleware d'authentification JWT.
 * Vérifie le Bearer token (access token) et injecte req.user.id.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(AppError.unauthorized('Authentification requise'));
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as { sub: string };
    req.user = { id: decoded.sub };
    next();
  } catch {
    next(AppError.unauthorized('Session expirée ou token invalide'));
  }
}

/**
 * Middleware d'authentification JWT pour les connexions SSE.
 *
 * EventSource (côté navigateur) ne supporte pas les headers custom — le token
 * JWT est passé en query param `?token=...` au lieu du header Authorization.
 *
 * Note : le token est visible dans les logs serveur (nginx, etc.). Mitigation
 * future : émettre un token SSE à courte durée via un endpoint dédié.
 */
export function requireAuthSse(req: Request, _res: Response, next: NextFunction): void {
  const token = req.query.token as string | undefined;

  if (!token) {
    next(AppError.unauthorized('Authentification requise'));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as { sub: string };
    req.user = { id: decoded.sub };
    next();
  } catch {
    next(AppError.unauthorized('Session expirée ou token invalide'));
  }
}
