import { Router } from 'express';
import * as accountAliasesController from '../controllers/accountAliasesController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { accountIdParamSchema } from '../schemas/accountSchemas.js';
import {
  createAliasSchema,
  updateAliasSchema,
  accountAliasParamsSchema,
} from '../schemas/aliasSchemas.js';

const router = Router({ mergeParams: true });

router.get(
  '/',
  requireAuth,
  validate({ params: accountIdParamSchema }),
  accountAliasesController.list,
);

router.post(
  '/',
  requireAuth,
  validate({ params: accountIdParamSchema, body: createAliasSchema }),
  accountAliasesController.create,
);

router.patch(
  '/:aliasId',
  requireAuth,
  validate({ params: accountAliasParamsSchema, body: updateAliasSchema }),
  accountAliasesController.update,
);

router.delete(
  '/:aliasId',
  requireAuth,
  validate({ params: accountAliasParamsSchema }),
  accountAliasesController.remove,
);

export const accountAliasesRoutes = router;
