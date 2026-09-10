import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { authRateLimit } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../schemas/authSchemas.js';

const router = Router();

router.post('/register', authRateLimit, validate({ body: registerSchema }), authController.register);
router.post('/login', authRateLimit, validate({ body: loginSchema }), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);

export const authRoutes = router;
