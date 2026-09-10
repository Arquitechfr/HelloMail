import { Router } from 'express';
import * as foldersController from '../controllers/foldersController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  folderAccountParamSchema,
  folderPathParamSchema,
  createFolderSchema,
  renameFolderSchema,
} from '../schemas/folderSchemas.js';

const router = Router();

// Liste des dossiers.
router.get(
  '/:accountId/folders',
  requireAuth,
  validate({ params: folderAccountParamSchema }),
  foldersController.list,
);

// Création d'un dossier.
router.post(
  '/:accountId/folders',
  requireAuth,
  validate({ params: folderAccountParamSchema, body: createFolderSchema }),
  foldersController.create,
);

// Statut d'un dossier (avant la route /:path pour éviter les conflits).
router.get(
  '/:accountId/folders/:path/status',
  requireAuth,
  validate({ params: folderPathParamSchema }),
  foldersController.status,
);

// Renommage d'un dossier.
router.patch(
  '/:accountId/folders/:path',
  requireAuth,
  validate({ params: folderPathParamSchema, body: renameFolderSchema }),
  foldersController.rename,
);

// Suppression d'un dossier.
router.delete(
  '/:accountId/folders/:path',
  requireAuth,
  validate({ params: folderPathParamSchema }),
  foldersController.remove,
);

export const foldersRoutes = router;
