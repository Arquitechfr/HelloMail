import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { objectIdParamSchema } from '../schemas/commonSchemas.js';
import {
  createRuleSchema,
  updateRuleSchema,
  reorderRulesSchema,
} from '../schemas/ruleSchemas.js';
import * as rulesController from '../controllers/rulesController.js';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(rulesController.list));
router.post('/', validate({ body: createRuleSchema }), asyncHandler(rulesController.create));
router.post('/reorder', validate({ body: reorderRulesSchema }), asyncHandler(rulesController.reorder));
router.patch(
  '/:id',
  validate({ params: objectIdParamSchema, body: updateRuleSchema }),
  asyncHandler(rulesController.update),
);
router.delete(
  '/:id',
  validate({ params: objectIdParamSchema }),
  asyncHandler(rulesController.remove),
);

export default router;
