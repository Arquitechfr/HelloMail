import { Response } from 'express';
import { env } from '../config/env.js';
import { COOKIE_REFRESH_TOKEN, JWT_REFRESH_EXPIRES_IN_DAYS } from '../config/constants.js';

/**
 * Définit le cookie httpOnly pour le refresh token.
 * - httpOnly : inaccessible au JS client (protection XSS)
 * - sameSite strict : envoyé uniquement sur les requêtes same-site
 * - path /api/auth : limité aux routes d'auth (refresh, logout)
 * - secure : en production uniquement (HTTPS)
 */
export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(COOKIE_REFRESH_TOKEN, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
  });
}

/**
 * Supprime le cookie refresh token.
 */
export function clearRefreshCookie(res: Response): void {
  res.clearCookie(COOKIE_REFRESH_TOKEN, { path: '/api/auth' });
}
