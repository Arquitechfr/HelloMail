import { z } from 'zod';

const accountIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Identifiant de compte invalide');
const pathSchema = z.string().min(1, 'Chemin du dossier requis').max(255, 'Chemin trop long');

/**
 * Params pour les routes folders avec accountId.
 */
export const folderAccountParamSchema = z.object({
  accountId: accountIdSchema,
});

/**
 * Params pour les routes folders avec accountId + path.
 */
export const folderPathParamSchema = z.object({
  accountId: accountIdSchema,
  path: pathSchema,
});

/**
 * Body pour la création d'un dossier.
 */
export const createFolderSchema = z.object({
  path: pathSchema,
});

/**
 * Body pour le renommage d'un dossier.
 */
export const renameFolderSchema = z.object({
  newPath: z.string().min(1, 'Nouveau chemin requis').max(255, 'Nouveau chemin trop long'),
});
