import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { exportUserProfile } from '../services/profile/profileExportService.js';
import {
  encryptProfilePayload,
  decryptProfilePayload,
  type IMailoraProfilePayload,
  type IEncryptedProfileBackup,
} from '../services/profile/profileCryptoService.js';
import { previewProfile as analyzeProfile, restoreProfile as applyRestore } from '../services/profile/profileImportService.js';
import {
  previewProfileSchema,
  restoreProfileSchema,
  profilePayloadSchema,
} from '../schemas/profileSchemas.js';

/**
 * Exporte le profil complet de l'utilisateur au format JSON clair ou chiffré.
 * GET /api/profile/export?encrypt=true&password=...
 */
export const exportProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const userId = req.user.id;
  const shouldEncrypt = req.query.encrypt === 'true';
  const password = typeof req.query.password === 'string' ? req.query.password : undefined;

  const payload = await exportUserProfile(userId);
  const dateStr = new Date().toISOString().slice(0, 10);

  if (shouldEncrypt) {
    if (!password) {
      throw AppError.badRequest('Le paramètre password est requis pour une sauvegarde chiffrée');
    }
    const encryptedData = encryptProfilePayload(payload, password);
    const filename = `mailora-profile-${dateStr}.enc.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(encryptedData);
    return;
  }

  const filename = `mailora-profile-${dateStr}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.json(payload);
});

/**
 * Prévisualise le contenu d'un profil importé (clair ou chiffré) sans modifier la base.
 * POST /api/profile/preview
 */
export const previewProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const userId = req.user.id;
  const parsed = previewProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    throw AppError.badRequest('Format de requête de prévisualisation invalide');
  }

  const { backupData, password } = parsed.data;
  let payload: IMailoraProfilePayload;
  let isEncrypted = false;

  if ('format' in backupData && backupData.format === 'mailora-encrypted-profile') {
    if (!password) {
      throw AppError.badRequest('Mot de passe requis pour déchiffrer ce profil');
    }
    isEncrypted = true;
    payload = decryptProfilePayload(backupData as IEncryptedProfileBackup, password);
  } else {
    payload = backupData as IMailoraProfilePayload;
  }

  // Valider le contenu extrait
  const contentValidation = profilePayloadSchema.safeParse(payload);
  if (!contentValidation.success) {
    throw AppError.badRequest('Structure de profil invalide');
  }

  const preview = await analyzeProfile(userId, payload, isEncrypted);
  res.json({ success: true, preview });
});

/**
 * Restaure de façon granulaire les modules sélectionnés selon la stratégie de conflit.
 * POST /api/profile/restore
 */
export const restoreProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const userId = req.user.id;
  const parsed = restoreProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    throw AppError.badRequest('Format de requête de restauration invalide');
  }

  const { backupData, password, sections, conflictStrategy } = parsed.data;
  let payload: IMailoraProfilePayload;

  if ('format' in backupData && backupData.format === 'mailora-encrypted-profile') {
    if (!password) {
      throw AppError.badRequest('Mot de passe requis pour déchiffrer ce profil');
    }
    payload = decryptProfilePayload(backupData as IEncryptedProfileBackup, password);
  } else {
    payload = backupData as IMailoraProfilePayload;
  }

  // Valider le contenu extrait
  const contentValidation = profilePayloadSchema.safeParse(payload);
  if (!contentValidation.success) {
    throw AppError.badRequest('Structure de profil invalide');
  }

  const report = await applyRestore(userId, payload, sections, conflictStrategy);
  res.json({ success: true, report });
});
