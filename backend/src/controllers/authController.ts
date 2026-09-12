import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth/authService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { setRefreshCookie, clearRefreshCookie } from '../utils/cookieHelpers.js';
import { COOKIE_REFRESH_TOKEN } from '../config/constants.js';
import { UserModel } from '../models/User.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const register = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const result = await AuthService.register(req.body);
  setRefreshCookie(res, result.refreshToken);
  res.status(201).json({
    accessToken: result.accessToken,
    user: result.user,
  });
});

export const login = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const result = await AuthService.login(req.body.email, req.body.password);

  // Si la 2FA est activée, retourne un jeton temporaire au lieu des tokens complets.
  if (result.requiresTwoFactor) {
    res.status(200).json({
      requiresTwoFactor: true,
      twoFactorTempToken: result.twoFactorTempToken,
    });
    return;
  }

  const tokenPair = result.tokenPair!;
  setRefreshCookie(res, tokenPair.refreshToken);
  res.status(200).json({
    accessToken: tokenPair.accessToken,
    user: tokenPair.user,
  });
});

/** Vérifie la 2FA (TOTP ou code de secours) lors du login. */
export const verifyTwoFactor = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const result = await AuthService.verifyTwoFactor(req.body.twoFactorTempToken, req.body.code);
  setRefreshCookie(res, result.refreshToken);
  res.status(200).json({
    accessToken: result.accessToken,
    user: result.user,
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const refreshToken = req.cookies?.[COOKIE_REFRESH_TOKEN];
  if (!refreshToken) {
    throw AppError.unauthorized('Refresh token manquant');
  }

  const result = await AuthService.refreshTokens(refreshToken);
  setRefreshCookie(res, result.refreshToken);
  res.status(200).json({
    accessToken: result.accessToken,
    user: result.user,
  });
});

export const logout = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const refreshToken = req.cookies?.[COOKIE_REFRESH_TOKEN];
  if (refreshToken) {
    await AuthService.logout(refreshToken);
  }
  clearRefreshCookie(res);
  res.status(200).json({ message: 'Déconnexion réussie' });
});

export const me = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const user = await UserModel.findById(req.user.id);
  if (!user) {
    throw AppError.notFound('Utilisateur introuvable');
  }
  res.status(200).json({
    user: {
      id: user._id.toString(),
      email: user.email,
      preferences: user.preferences,
    },
  });
});

export const updatePreferences = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  // Patch champ par champ — ne pas écraser les préférences non fournies.
  const update: Record<string, unknown> = {};
  if (req.body.undoSendDelay !== undefined) update['preferences.undoSendDelay'] = req.body.undoSendDelay;
  if (req.body.autoAddContacts !== undefined) update['preferences.autoAddContacts'] = req.body.autoAddContacts;
  if (req.body.unifiedFoldersEnabled !== undefined) update['preferences.unifiedFoldersEnabled'] = req.body.unifiedFoldersEnabled;
  if (req.body.unifiedFolders !== undefined) update['preferences.unifiedFolders'] = req.body.unifiedFolders;
  if (req.body.displayDensity !== undefined) update['preferences.displayDensity'] = req.body.displayDensity;
  if (req.body.swipeRightAction !== undefined) update['preferences.swipeRightAction'] = req.body.swipeRightAction;
  if (req.body.swipeLeftAction !== undefined) update['preferences.swipeLeftAction'] = req.body.swipeLeftAction;
  if (req.body.attachmentReminderEnabled !== undefined) update['preferences.attachmentReminderEnabled'] = req.body.attachmentReminderEnabled;
  if (req.body.smartRepliesEnabled !== undefined) update['preferences.smartRepliesEnabled'] = req.body.smartRepliesEnabled;

  const user = await UserModel.findByIdAndUpdate(
    req.user.id,
    { $set: update },
    { returnDocument: 'after', runValidators: true },
  );
  if (!user) {
    throw AppError.notFound('Utilisateur introuvable');
  }
  res.status(200).json({
    user: {
      id: user._id.toString(),
      email: user.email,
      preferences: user.preferences,
    },
  });
});

