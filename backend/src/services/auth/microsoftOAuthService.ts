import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../utils/AppError.js';
import { decrypt } from '../security/encryptionService.js';
import { AccountModel, type IAccountDocument } from '../../models/Account.js';

/** Scopes Microsoft pour IMAP/SMTP via XOAUTH2 et informations utilisateur. */
const MICROSOFT_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'https://outlook.office.com/IMAP.AccessAsUser.All',
  'https://outlook.office.com/SMTP.Send',
].join(' ');

/** URL d'autorisation Microsoft Identity Platform v2.0. */
const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';

/** Endpoint d'échange de token Microsoft. */
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

/** Paramètres IMAP/SMTP par défaut pour Outlook / Office 365. */
export const OUTLOOK_IMAP_DEFAULTS = {
  host: 'outlook.office365.com',
  port: 993,
  secure: true,
  smtpHost: 'smtp.office365.com',
  smtpPort: 587,
  smtpSecure: false,
};

export interface MicrosoftTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

/**
 * Génère l'URL d'autorisation Microsoft pour le flux OAuth 2.0.
 */
export function getMicrosoftAuthUrl(state: string): string {
  if (!env.MICROSOFT_CLIENT_ID) {
    throw AppError.badRequest('OAuth Microsoft non configuré — MICROSOFT_CLIENT_ID manquant');
  }

  const params = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID,
    response_type: 'code',
    redirect_uri: env.MICROSOFT_REDIRECT_URI,
    response_mode: 'query',
    scope: MICROSOFT_SCOPES,
    state,
  });

  return `${MICROSOFT_AUTH_URL}?${params.toString()}`;
}

/**
 * Échange un code d'autorisation contre des tokens Microsoft (access + refresh).
 */
export async function exchangeMicrosoftCode(code: string): Promise<MicrosoftTokenResponse> {
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
    throw AppError.badRequest('OAuth Microsoft non configuré');
  }

  const response = await fetch(MICROSOFT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.MICROSOFT_CLIENT_ID,
      client_secret: env.MICROSOFT_CLIENT_SECRET,
      code,
      redirect_uri: env.MICROSOFT_REDIRECT_URI,
      grant_type: 'authorization_code',
      scope: MICROSOFT_SCOPES,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error({ status: response.status, error }, 'Échec échange code Microsoft');
    throw AppError.unauthorized('Échange de code Microsoft échoué');
  }

  return (await response.json()) as MicrosoftTokenResponse;
}

/**
 * Renouvelle l'access token Microsoft à partir du refresh token chiffré.
 */
export async function refreshMicrosoftAccessToken(account: IAccountDocument): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  if (!account.oauthConfig?.encryptedRefreshToken) {
    throw AppError.badRequest('Refresh token OAuth manquant pour ce compte');
  }

  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
    throw AppError.badRequest('OAuth Microsoft non configuré');
  }

  const refreshToken = decrypt(account.oauthConfig.encryptedRefreshToken);

  const response = await fetch(MICROSOFT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.MICROSOFT_CLIENT_ID,
      client_secret: env.MICROSOFT_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: MICROSOFT_SCOPES,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error(
      { accountId: String(account._id), status: response.status, error },
      'Échec refresh token Microsoft',
    );
    throw AppError.unauthorized('Renouvellement du token Microsoft échoué');
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  // Met à jour l'expiration du token en base
  await AccountModel.updateOne(
    { _id: account._id },
    { 'oauthConfig.accessTokenExpiresAt': expiresAt },
  );

  return { accessToken: data.access_token, expiresAt };
}

/** Cache en mémoire pour les tokens d'accès Microsoft */
const microsoftTokenCache = new Map<string, { accessToken: string; expiresAt: Date }>();

/**
 * Retourne un access token Microsoft valide (renouvelle si expiré).
 */
export async function getValidMicrosoftAccessToken(account: IAccountDocument): Promise<string> {
  const accountId = String(account._id);
  const cached = microsoftTokenCache.get(accountId);

  if (cached && cached.expiresAt.getTime() > Date.now() + 60_000) {
    return cached.accessToken;
  }

  const result = await refreshMicrosoftAccessToken(account);
  microsoftTokenCache.set(accountId, result);
  return result.accessToken;
}

/**
 * Invalide le cache Microsoft lors d'une déconnexion/suppression.
 */
export function invalidateMicrosoftTokenCache(accountId: string): void {
  microsoftTokenCache.delete(accountId);
}
