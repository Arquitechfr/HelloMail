import { Router } from 'express';
import * as scheduledMessagesController from '../controllers/scheduledMessagesController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  scheduledAccountParamsSchema,
  scheduledIdParamsSchema,
  scheduleEmailSchema,
} from '../schemas/scheduledMessageSchemas.js';

const router = Router();

// Programmer un email (Send Later)
router.post(
  '/:accountId/scheduled',
  requireAuth,
  validate({ params: scheduledAccountParamsSchema, body: scheduleEmailSchema }),
  scheduledMessagesController.schedule,
);

// Lister les emails programmés d'un compte
router.get(
  '/:accountId/scheduled',
  requireAuth,
  validate({ params: scheduledAccountParamsSchema }),
  scheduledMessagesController.list,
);

// Récupérer un email programmé
router.get(
  '/:accountId/scheduled/:id',
  requireAuth,
  validate({ params: scheduledIdParamsSchema }),
  scheduledMessagesController.getOne,
);

// Annuler un email programmé
router.delete(
  '/:accountId/scheduled/:id',
  requireAuth,
  validate({ params: scheduledIdParamsSchema }),
  scheduledMessagesController.cancel,
);

export const scheduledMessagesRoutes = router;
