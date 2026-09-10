import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { objectIdParamSchema } from '../schemas/commonSchemas.js';
import {
  createTagSchema,
  updateTagSchema,
  batchSetMessageTagsSchema,
} from '../schemas/tagSchemas.js';
import * as tagsController from '../controllers/tagsController.js';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(tagsController.list));
router.post('/', validate({ body: createTagSchema }), asyncHandler(tagsController.create));
router.patch(
  '/:id',
  validate({ params: objectIdParamSchema, body: updateTagSchema }),
  asyncHandler(tagsController.update),
);
router.delete(
  '/:id',
  validate({ params: objectIdParamSchema }),
  asyncHandler(tagsController.remove),
);
router.post(
  '/:accountId/batch',
  validate({ body: batchSetMessageTagsSchema }),
  asyncHandler(tagsController.batchSetMessageTags),
);

export default router;
