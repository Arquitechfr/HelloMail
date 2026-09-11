import { Request, Response, NextFunction } from 'express';
import { AccountModel } from '../models/Account.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import {
  getGoogleAuthUrl,
  createOAuthState,
  verifyOAuthState,
  exchangeGoogleCode,
  encryptRefreshToken,
  GMAIL_IMAP_DEFAULTS,
} from '../services/auth/oauthService.js';
import {
  getMicrosoftAuthUrl,
  exchangeMicrosoftCode,
  OUTLOOK_IMAP_DEFAULTS,
} from '../services/auth/microsoftOAuthService.js';
import { getNextAccountColor } from '../config/accountColors.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * GET /api/accounts/oauth/google — redirige vers Google pour l'autorisation.
 * RequireAuth : l'utilisateur doit être connecté pour lier un compte Google.
 */
export const googleRedirect = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    const state = createOAuthState(req.user.id);
    const authUrl = getGoogleAuthUrl(state);
    res.redirect(authUrl);
  },
);

/**
 * GET /api/accounts/oauth/google/callback — callback Google après autorisation.
 * Valide le state (CSRF + userId), échange le code, crée le compte OAuth.
 */
export const googleCallback = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { code, state, error } = req.query;

    // Google peut retourner une erreur (ex: utilisateur refuse l'accès).
    if (error) {
      res.redirect(`${env.FRONTEND_URL[0]}/mail?oauth_error=${encodeURIComponent(String(error))}`);
      return;
    }

    if (!code || typeof code !== 'string') {
      throw AppError.badRequest('Code d\'autorisation manquant');
    }

    // Valide le state et récupère l'userId.
    const userId = verifyOAuthState(state as string);

    // Échange le code contre des tokens.
    const tokens = await exchangeGoogleCode(code);

    if (!tokens.refresh_token) {
      throw AppError.badRequest('Refresh token Google manquant — réessayez en révoquant l\'accès dans Google');
    }

    // Récupère l'adresse email via le userinfo endpoint de Google.
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      throw AppError.unprocessable('Impossible de récupérer les informations utilisateur Google');
    }

    const userInfo = (await userInfoResponse.json()) as { email: string };

    // Vérifie l'unicité du compte (userId + emailAddress).
    const existing = await AccountModel.findOne({ userId, emailAddress: userInfo.email });
    if (existing) {
      // Le compte existe déjà → met à jour le refresh token.
      existing.oauthConfig = {
        encryptedRefreshToken: encryptRefreshToken(tokens.refresh_token),
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope.split(' '),
      };
      await existing.save();
      logger.info({ userId, emailAddress: userInfo.email }, 'Compte Google OAuth mis à jour');
    } else {
      // Crée un nouveau compte OAuth.
      const color = await getNextAccountColor(userId);
      const account = new AccountModel({
        userId,
        provider: 'google_oauth',
        emailAddress: userInfo.email,
        color,
        imapConfig: {
          host: GMAIL_IMAP_DEFAULTS.host,
          port: GMAIL_IMAP_DEFAULTS.port,
          secure: GMAIL_IMAP_DEFAULTS.secure,
          smtpHost: GMAIL_IMAP_DEFAULTS.smtpHost,
          smtpPort: GMAIL_IMAP_DEFAULTS.smtpPort,
          smtpSecure: GMAIL_IMAP_DEFAULTS.smtpSecure,
          username: userInfo.email,
        },
        oauthConfig: {
          encryptedRefreshToken: encryptRefreshToken(tokens.refresh_token),
          accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          scope: tokens.scope.split(' '),
        },
      });
      await account.save();
      logger.info({ userId, emailAddress: userInfo.email }, 'Compte Google OAuth créé');
    }

    // Redirige vers le frontend.
    res.redirect(`${env.FRONTEND_URL[0]}/mail?oauth_success=true`);
  },
);

/**
 * GET /api/accounts/oauth/microsoft — redirige vers Microsoft pour l'autorisation.
 */
export const microsoftRedirect = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    const state = createOAuthState(req.user.id, 'microsoft_oauth');
    const authUrl = getMicrosoftAuthUrl(state);
    res.redirect(authUrl);
  },
);

/**
 * GET /api/accounts/oauth/microsoft/callback — callback Microsoft après autorisation.
 */
export const microsoftCallback = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { code, state, error } = req.query;

    if (error) {
      res.redirect(
        `${env.FRONTEND_URL[0]}/mail?oauth_error=${encodeURIComponent(String(error))}`,
      );
      return;
    }

    if (!code || typeof code !== 'string') {
      throw AppError.badRequest('Code d\'autorisation manquant');
    }

    const userId = verifyOAuthState(state as string, 'microsoft_oauth');
    const tokens = await exchangeMicrosoftCode(code);

    if (!tokens.refresh_token) {
      throw AppError.badRequest('Refresh token Microsoft manquant');
    }

    // Récupère l'adresse email via Microsoft Graph
    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!graphResponse.ok) {
      throw AppError.unprocessable('Impossible de récupérer les informations utilisateur Microsoft');
    }

    const graphUser = (await graphResponse.json()) as { mail?: string; userPrincipalName?: string };
    const email = graphUser.mail || graphUser.userPrincipalName;

    if (!email) {
      throw AppError.unprocessable('Adresse email introuvable dans le profil Microsoft');
    }

    const existing = await AccountModel.findOne({ userId, emailAddress: email.toLowerCase() });
    if (existing) {
      existing.oauthConfig = {
        encryptedRefreshToken: encryptRefreshToken(tokens.refresh_token),
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope ? tokens.scope.split(' ') : [],
      };
      await existing.save();
      logger.info({ userId, emailAddress: email }, 'Compte Microsoft OAuth mis à jour');
    } else {
      const color = await getNextAccountColor(userId);
      const account = new AccountModel({
        userId,
        provider: 'microsoft_oauth',
        emailAddress: email.toLowerCase(),
        color,
        imapConfig: {
          host: OUTLOOK_IMAP_DEFAULTS.host,
          port: OUTLOOK_IMAP_DEFAULTS.port,
          secure: OUTLOOK_IMAP_DEFAULTS.secure,
          smtpHost: OUTLOOK_IMAP_DEFAULTS.smtpHost,
          smtpPort: OUTLOOK_IMAP_DEFAULTS.smtpPort,
          smtpSecure: OUTLOOK_IMAP_DEFAULTS.smtpSecure,
          username: email.toLowerCase(),
        },
        oauthConfig: {
          encryptedRefreshToken: encryptRefreshToken(tokens.refresh_token),
          accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          scope: tokens.scope ? tokens.scope.split(' ') : [],
        },
      });
      await account.save();
      logger.info({ userId, emailAddress: email }, 'Compte Microsoft OAuth créé');
    }

    res.redirect(`${env.FRONTEND_URL[0]}/mail?oauth_success=true`);
  },
);
