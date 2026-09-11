import { Router } from 'express';
import * as unifiedController from '../controllers/unifiedController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { unifiedMessagesQuerySchema } from '../schemas/unifiedSchemas.js';

const router = Router();

router.get(
  '/messages',
  requireAuth,
  validate({ query: unifiedMessagesQuerySchema }),
  unifiedController.listMessages,
);

router.get('/status', requireAuth, unifiedController.getStatus);

export const unifiedRoutes = router;
