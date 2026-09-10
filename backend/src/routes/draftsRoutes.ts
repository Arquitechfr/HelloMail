import { Router } from 'express';
import * as draftsController from '../controllers/draftsController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  draftAccountParamSchema,
  createDraftSchema,
  updateDraftSchema,
  draftDeleteParamsSchema,
} from '../schemas/draftSchemas.js';

const router = Router();

// Création d'un brouillon (append dans le dossier Drafts via IMAP).
router.post(
  '/:accountId/drafts',
  requireAuth,
  validate({ params: draftAccountParamSchema, body: createDraftSchema }),
  draftsController.create,
);

// Modification d'un brouillon (suppression ancien + append nouveau).
router.patch(
  '/:accountId/drafts/:uid',
  requireAuth,
  validate({ params: updateDraftSchema, body: createDraftSchema }),
  draftsController.update,
);

// Suppression d'un brouillon.
router.delete(
  '/:accountId/drafts/:uid',
  requireAuth,
  validate({ params: draftDeleteParamsSchema }),
  draftsController.remove,
);

export const draftsRoutes = router;
