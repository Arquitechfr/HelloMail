import { Router } from 'express';
import * as exportController from '../controllers/exportController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  exportAccountParamsSchema,
  exportMboxQuerySchema,
  exportZipQuerySchema,
} from '../schemas/exportSchemas.js';

const router = Router();

router.get(
  '/:accountId/export/mbox',
  requireAuth,
  validate({ params: exportAccountParamsSchema, query: exportMboxQuerySchema }),
  exportController.exportMbox,
);

router.get(
  '/:accountId/export/zip',
  requireAuth,
  validate({ params: exportAccountParamsSchema, query: exportZipQuerySchema }),
  exportController.exportZip,
);

export const exportRoutes = router;
