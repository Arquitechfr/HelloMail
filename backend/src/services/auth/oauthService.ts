import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../utils/AppError.js';
import { encrypt, decrypt, type EncryptedPayload } from '../security/encryptionService.js';
import { AccountModel, type IAccountDocument } from '../../models/Account.js';

/** Scope Google pour IMAP/SMTP via XOAUTH2. */
const GOOGLE_SCOPE = 'https://mail.google.com/';

/** URL d'autorisation Google. */
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

/** Endpoint d'échange de token Google. */
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** Paramètres IMAP/SMTP par défaut pour Gmail. */
export const GMAIL_IMAP_DEFAULTS = {
  host: 'imap.gmail.com',
  port: 993,
  secure: true,
  smtpHost: 'smtp.gmail.com',
  smtpPort: 465,
  smtpSecure: true,
};

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

/**
 * Génère l'URL d'autorisation Google pour le flow OAuth 2.0.
 * `state` est un JWT signé contenant l'userId (protection CSRF + lien utilisateur).
 */
export function getGoogleAuthUrl(state: string): string {
  if (!env.GOOGLE_CLIENT_ID) {
    throw AppError.badRequest('OAuth Google non configuré — GOOGLE_CLIENT_ID manquant');
  }

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: GOOGLE_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Génère un state JWT signé pour le flow OAuth (contient l'userId).
 * Expire après 10 minutes.
 */
export function createOAuthState(userId: string): string {
  return jwt.sign({ sub: userId, action: 'google_oauth' }, env.JWT_ACCESS_SECRET, {
    expiresIn: '10m',
    algorithm: 'HS256',
  });
}

/**
 * Vérifie le state JWT retourné par Google et retourne l'userId.
 */
export function verifyOAuthState(state: string): string {
  try {
    const decoded = jwt.verify(state, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as {
      sub: string;
      action: string;
    };
    if (decoded.action !== 'google_oauth') {
      throw new Error('Action invalide');
    }
    return decoded.sub;
  } catch {
    throw AppError.unauthorized('State OAuth invalide ou expiré');
  }
}

/**
 * Échange un code d'autorisation contre des tokens Google (access + refresh).
 */
export async function exchangeGoogleCode(code: string): Promise<GoogleTokenResponse> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw AppError.badRequest('OAuth Google non configuré');
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error({ status: response.status, error }, 'Échec échange code Google');
    throw AppError.unauthorized('Échange de code Google échoué');
  }

  return (await response.json()) as GoogleTokenResponse;
}

/**
 * Renouvelle l'access token Google à partir du refresh token chiffré.
 */
export async function refreshGoogleAccessToken(account: IAccountDocument): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  if (!account.oauthConfig?.encryptedRefreshToken) {
    throw AppError.badRequest('Refresh token OAuth manquant pour ce compte');
  }

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw AppError.badRequest('OAuth Google non configuré');
  }

  const refreshToken = decrypt(account.oauthConfig.encryptedRefreshToken);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error({ accountId: String(account._id), status: response.status, error }, 'Échec refresh token Google');
    throw AppError.unauthorized('Renouvellement du token Google échoué');
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  // Met à jour le compte en base avec le nouveau token + expiration.
  await AccountModel.updateOne(
    { _id: account._id },
    { 'oauthConfig.accessTokenExpiresAt': expiresAt },
  );

  return { accessToken: data.access_token, expiresAt };
}

/**
 * Retourne un access token Google valide (renouvelle si expiré).
 * Utilise un cache en mémoire pour éviter de frapper Google à chaque requête.
 */
const tokenCache = new Map<string, { accessToken: string; expiresAt: Date }>();

export async function getValidGoogleAccessToken(account: IAccountDocument): Promise<string> {
  const accountId = String(account._id);
  const cached = tokenCache.get(accountId);

  // Cache valide avec 60s de marge.
  if (cached && cached.expiresAt.getTime() > Date.now() + 60_000) {
    return cached.accessToken;
  }

  // Vérifie si le token en base est encore valide (avec 60s de marge).
  const expiresAt = account.oauthConfig?.accessTokenExpiresAt;
  if (expiresAt && expiresAt.getTime() > Date.now() + 60_000) {
    // Le token en base est valide mais pas en cache → il faut le récupérer.
    // Comme on ne stocke pas l'access token en base (seulement l'expiration),
    // on doit le rafraîchir.
  }

  // Renouvelle le token.
  const result = await refreshGoogleAccessToken(account);
  tokenCache.set(accountId, result);
  return result.accessToken;
}

/** Invalide le cache de token pour un compte (à appeler après suppression/déconnexion). */
export function invalidateTokenCache(accountId: string): void {
  tokenCache.delete(accountId);
}

/**
 * Retourne l'authentification ImapFlow pour un compte (IMAP password ou XOAUTH2).
 */
export async function getImapAuth(
  account: IAccountDocument,
): Promise<{ user: string; pass?: string; accessToken?: string }> {
  if (account.provider === 'imap') {
    if (!account.imapConfig?.encryptedPassword) {
      throw AppError.badRequest('Configuration IMAP manquante');
    }
    const password = decrypt(account.imapConfig.encryptedPassword);
    return { user: account.imapConfig.username, pass: password };
  }

  if (account.provider === 'google_oauth') {
    const accessToken = await getValidGoogleAccessToken(account);
    return { user: account.emailAddress, accessToken };
  }

  throw AppError.badRequest('Provider non supporté');
}

/**
 * Retourne l'authentification Nodemailer pour un compte (password ou OAuth2).
 */
export async function getSmtpAuth(
  account: IAccountDocument,
): Promise<{ user: string; pass?: string; type?: string; accessToken?: string }> {
  if (account.provider === 'imap') {
    if (!account.imapConfig?.encryptedPassword) {
      throw AppError.badRequest('Configuration IMAP manquante');
    }
    const password = decrypt(account.imapConfig.encryptedPassword);
    return { user: account.imapConfig.username, pass: password };
  }

  if (account.provider === 'google_oauth') {
    const accessToken = await getValidGoogleAccessToken(account);
    return { user: account.emailAddress, type: 'OAuth2', accessToken };
  }

  throw AppError.badRequest('Provider non supporté');
}

/**
 * Chiffre un refresh token Google pour stockage en base.
 */
export function encryptRefreshToken(refreshToken: string): EncryptedPayload {
  return encrypt(refreshToken);
}
