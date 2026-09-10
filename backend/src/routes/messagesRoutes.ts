import { Router } from 'express';
import * as messagesController from '../controllers/messagesController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listMessagesParamsSchema, listMessagesQuerySchema } from '../schemas/messageSchemas.js';

const router = Router();

router.get(
  '/:accountId/messages',
  requireAuth,
  validate({ params: listMessagesParamsSchema, query: listMessagesQuerySchema }),
  messagesController.list,
);

export const messagesRoutes = router;
