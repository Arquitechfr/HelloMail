import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { objectIdParamSchema } from '../schemas/commonSchemas.js';
import {
  createSmartFolderSchema,
  updateSmartFolderSchema,
  reorderSmartFoldersSchema,
} from '../schemas/smartFolderSchemas.js';
import * as smartFoldersController from '../controllers/smartFoldersController.js';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(smartFoldersController.list));
router.get('/counts', asyncHandler(smartFoldersController.getCounts));
router.post('/', validate({ body: createSmartFolderSchema }), asyncHandler(smartFoldersController.create));
router.post('/reorder', validate({ body: reorderSmartFoldersSchema }), asyncHandler(smartFoldersController.reorder));
router.get(
  '/:id/messages',
  validate({ params: objectIdParamSchema }),
  asyncHandler(smartFoldersController.getMessages),
);
router.patch(
  '/:id',
  validate({ params: objectIdParamSchema, body: updateSmartFolderSchema }),
  asyncHandler(smartFoldersController.update),
);
router.delete(
  '/:id',
  validate({ params: objectIdParamSchema }),
  asyncHandler(smartFoldersController.remove),
);

export default router;
