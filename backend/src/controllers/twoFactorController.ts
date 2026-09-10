import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { UserModel } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import {
  generateTOTPSetup,
  enableTOTP,
  disable2FA,
} from '../services/auth/twoFactorService.js';
import {
  generateWebAuthnRegistration,
  verifyWebAuthnRegistration,
  generateWebAuthnLogin,
  verifyWebAuthnLogin,
} from '../services/auth/webauthnService.js';

/**
 * GET /api/auth/2fa/status — retourne l'état 2FA de l'utilisateur.
 */
export const get2FAStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const user = await UserModel.findById(req.user.id).select('+twoFactorEnabled +webauthnCredentials');
  if (!user) {
    throw AppError.notFound('Utilisateur introuvable');
  }
  res.status(200).json({
    twoFactorEnabled: user.twoFactorEnabled,
    webauthnCredentialsCount: user.webauthnCredentials?.length ?? 0,
  });
});

/**
 * POST /api/auth/2fa/totp/setup — génère le QR code TOTP.
 */
export const setupTOTP = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const user = await UserModel.findById(req.user.id);
  if (!user) {
    throw AppError.notFound('Utilisateur introuvable');
  }
  const result = await generateTOTPSetup(user);
  res.status(200).json(result);
});

/**
 * POST /api/auth/2fa/totp/enable — vérifie le code TOTP et active la 2FA.
 */
export const enableTOTPHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const user = await UserModel.findById(req.user.id).select('+twoFactorSecret');
  if (!user) {
    throw AppError.notFound('Utilisateur introuvable');
  }
  const result = await enableTOTP(user, req.body.token);
  res.status(200).json(result);
});

/**
 * POST /api/auth/2fa/disable — désactive la 2FA (mot de passe requis).
 */
export const disable2FAHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const user = await UserModel.findById(req.user.id).select('+passwordHash');
  if (!user || !user.passwordHash) {
    throw AppError.notFound('Utilisateur introuvable');
  }

  const isValid = await bcrypt.compare(req.body.password, user.passwordHash);
  if (!isValid) {
    throw AppError.unauthorized('Mot de passe invalide');
  }

  await disable2FA(user);
  res.status(200).json({ message: '2FA désactivée' });
});

/**
 * POST /api/auth/2fa/webauthn/register/start — génère les options d'enregistrement.
 */
export const webauthnRegisterStart = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const user = await UserModel.findById(req.user.id).select('+webauthnCredentials');
  if (!user) {
    throw AppError.notFound('Utilisateur introuvable');
  }
  const options = await generateWebAuthnRegistration(user);
  res.status(200).json(options);
});

/**
 * POST /api/auth/2fa/webauthn/register/finish — vérifie l'enregistrement.
 */
export const webauthnRegisterFinish = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const user = await UserModel.findById(req.user.id).select('+webauthnCredentials +currentWebauthnChallenge');
  if (!user) {
    throw AppError.notFound('Utilisateur introuvable');
  }
  const result = await verifyWebAuthnRegistration(user, req.body.response);
  res.status(200).json(result);
});

/**
 * POST /api/auth/2fa/webauthn/login/start — génère les options de login.
 * Body : { email }
 */
export const webauthnLoginStart = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { email } = req.body;
  if (!email) {
    throw AppError.badRequest('Email requis');
  }
  const user = await UserModel.findOne({ email }).select('+webauthnCredentials +currentWebauthnChallenge +twoFactorEnabled');
  if (!user) {
    throw AppError.notFound('Utilisateur introuvable');
  }
  if (!user.twoFactorEnabled) {
    throw AppError.badRequest('2FA non activée pour cet utilisateur');
  }
  const options = await generateWebAuthnLogin(user);
  res.status(200).json(options);
});

/**
 * POST /api/auth/2fa/webauthn/login/finish — vérifie le login WebAuthn.
 * Body : { email, response }
 */
export const webauthnLoginFinish = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { email, response } = req.body;
  if (!email || !response) {
    throw AppError.badRequest('Email et response requis');
  }
  const user = await UserModel.findOne({ email }).select('+webauthnCredentials +currentWebauthnChallenge +twoFactorEnabled');
  if (!user) {
    throw AppError.notFound('Utilisateur introuvable');
  }
  if (!user.twoFactorEnabled) {
    throw AppError.badRequest('2FA non activée pour cet utilisateur');
  }
  await verifyWebAuthnLogin(user, response);
  // TODO: générer les tokens complets après login WebAuthn
  res.status(200).json({ verified: true });
});
