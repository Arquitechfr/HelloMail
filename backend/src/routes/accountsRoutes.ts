import { Router } from 'express';
import * as accountsController from '../controllers/accountsController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createImapAccountSchema,
  accountIdParamSchema,
  toggleAccountActiveSchema,
  autoconfigQuerySchema,
  updateSignatureSchema,
  updateAccountSchema,
} from '../schemas/accountSchemas.js';
import { accountAliasesRoutes } from './accountAliasesRoutes.js';

const router = Router();

router.use('/:id/aliases', accountAliasesRoutes);

router.get('/autoconfig', requireAuth, validate({ query: autoconfigQuerySchema }), accountsController.autoconfig);
router.post('/', requireAuth, validate({ body: createImapAccountSchema }), accountsController.create);
router.get('/', requireAuth, accountsController.list);
router.patch(
  '/:id',
  requireAuth,
  validate({ params: accountIdParamSchema, body: updateAccountSchema }),
  accountsController.update,
);
router.delete('/:id', requireAuth, validate({ params: accountIdParamSchema }), accountsController.remove);
router.patch(
  '/:id/active',
  requireAuth,
  validate({ params: accountIdParamSchema, body: toggleAccountActiveSchema }),
  accountsController.toggleActive,
);
router.patch(
  '/:id/signature',
  requireAuth,
  validate({ params: accountIdParamSchema, body: updateSignatureSchema }),
  accountsController.updateSignature,
);

export const accountsRoutes = router;
