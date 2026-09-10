import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { UserModel, IUserDocument, IUserPreferences } from '../../models/User.js';
import { RefreshTokenModel } from '../../models/RefreshToken.js';
import { verify2FALogin, is2FAEnabled } from './twoFactorService.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; preferences?: IUserPreferences };
}

export interface LoginResult {
  requiresTwoFactor?: boolean;
  twoFactorTempToken?: string;
  tokenPair?: TokenPair;
}

export class AuthService {
  static async register(data: { email: string; password: string }): Promise<TokenPair> {
    const existing = await UserModel.findOne({ email: data.email });
    if (existing) {
      throw AppError.conflict('Un compte existe déjà avec cette adresse email');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await UserModel.create({ email: data.email, passwordHash });

    return this.generateTokens(user);
  }

  static async login(email: string, password: string): Promise<LoginResult> {
    const user = await UserModel.findOne({ email }).select('+passwordHash +twoFactorEnabled +twoFactorSecret +twoFactorBackupCodes');

    if (!user || !user.passwordHash) {
      throw AppError.unauthorized('Identifiants invalides');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw AppError.unauthorized('Identifiants invalides');
    }

    // Si la 2FA est activée, retourne un jeton temporaire au lieu des tokens complets.
    if (is2FAEnabled(user)) {
      const twoFactorTempToken = this.generateTwoFactorTempToken(user);
      return { requiresTwoFactor: true, twoFactorTempToken };
    }

    return { tokenPair: await this.generateTokens(user) };
  }

  /**
   * Vérifie la 2FA (TOTP ou code de secours) et retourne les tokens complets.
   */
  static async verifyTwoFactor(twoFactorTempToken: string, code: string): Promise<TokenPair> {
    const userId = this.verifyTwoFactorTempToken(twoFactorTempToken);

    const user = await UserModel.findById(userId).select('+twoFactorEnabled +twoFactorSecret +twoFactorBackupCodes');
    if (!user) {
      throw AppError.unauthorized('Utilisateur introuvable');
    }

    if (!is2FAEnabled(user)) {
      throw AppError.badRequest('2FA non activée pour cet utilisateur');
    }

    const isValid = await verify2FALogin(user, code);
    if (!isValid) {
      throw AppError.unauthorized('Code 2FA invalide');
    }

    return this.generateTokens(user);
  }

  static async refreshTokens(rawRefreshToken: string): Promise<TokenPair> {
    let decoded: { sub: string; tokenId: string };

    try {
      decoded = jwt.verify(rawRefreshToken, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as { sub: string; tokenId: string };
    } catch {
      throw AppError.unauthorized('Refresh token expiré ou invalide');
    }

    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const storedToken = await RefreshTokenModel.findOne({
      user: decoded.sub,
      tokenHash,
      revoked: false,
    });

    if (!storedToken) {
      // Détection de réutilisation : révoquer tous les tokens de l'utilisateur
      await RefreshTokenModel.updateMany({ user: decoded.sub }, { revoked: true });
      throw AppError.unauthorized('Refresh token révoqué ou suspect');
    }

    // Rotation : marquer l'ancien token comme révoqué
    storedToken.revoked = true;
    await storedToken.save();

    const user = await UserModel.findById(decoded.sub);
    if (!user) {
      throw AppError.unauthorized('Utilisateur introuvable');
    }

    return this.generateTokens(user);
  }

  static async logout(rawRefreshToken: string): Promise<void> {
    if (!rawRefreshToken) return;
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    await RefreshTokenModel.updateOne({ tokenHash }, { revoked: true });
  }

  /**
   * Génère un jeton temporaire (5min) pour la vérification 2FA.
   * Contient uniquement l'userId — pas d'accès aux ressources.
   */
  private static generateTwoFactorTempToken(user: IUserDocument): string {
    return jwt.sign(
      { sub: user._id.toString(), action: '2fa_verify' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '5m', algorithm: 'HS256' },
    );
  }

  /**
   * Vérifie un jeton temporaire 2FA et retourne l'userId.
   */
  private static verifyTwoFactorTempToken(token: string): string {
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as {
        sub: string;
        action: string;
      };
      if (decoded.action !== '2fa_verify') {
        throw new Error('Action invalide');
      }
      return decoded.sub;
    } catch {
      throw AppError.unauthorized('Jeton 2FA invalide ou expiré');
    }
  }

  private static async generateTokens(user: IUserDocument): Promise<TokenPair> {
    const tokenId = crypto.randomUUID();

    const accessToken = jwt.sign(
      { sub: user._id.toString(), email: user.email },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    );

    const refreshToken = jwt.sign(
      { sub: user._id.toString(), tokenId },
      env.JWT_REFRESH_SECRET,
      { expiresIn: `${env.JWT_REFRESH_EXPIRES_IN_DAYS}d` as jwt.SignOptions['expiresIn'] },
    );

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

    await RefreshTokenModel.create({
      user: user._id,
      tokenHash,
      expiresAt,
      revoked: false,
    });

    return {
      accessToken,
      refreshToken,
      user: { id: user._id.toString(), email: user.email, preferences: user.preferences },
    };
  }
}
