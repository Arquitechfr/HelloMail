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
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string };
    req.user = { id: decoded.sub };
    next();
  } catch {
    next(AppError.unauthorized('Session expirée ou token invalide'));
  }
}
