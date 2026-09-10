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
  res.status(200).json({ user: { id: user._id.toString(), email: user.email } });
});
