import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  templateParamsSchema,
  templateQuerySchema,
  createTemplateSchema,
  updateTemplateSchema,
} from '../schemas/templateSchemas.js';
import * as templatesController from '../controllers/templatesController.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  validate({ query: templateQuerySchema }),
  asyncHandler(templatesController.list),
);

router.post(
  '/',
  validate({ body: createTemplateSchema }),
  asyncHandler(templatesController.create),
);

router.get(
  '/:id',
  validate({ params: templateParamsSchema }),
  asyncHandler(templatesController.getOne),
);

router.patch(
  '/:id',
  validate({ params: templateParamsSchema, body: updateTemplateSchema }),
  asyncHandler(templatesController.update),
);

router.delete(
  '/:id',
  validate({ params: templateParamsSchema }),
  asyncHandler(templatesController.remove),
);

export default router;
