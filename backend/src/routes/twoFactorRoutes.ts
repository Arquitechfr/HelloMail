import { Router } from 'express';
import * as twoFactorController from '../controllers/twoFactorController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  enableTOTPSchema,
  disable2FASchema,
  webauthnResponseSchema,
} from '../schemas/authSchemas.js';
import { z } from 'zod';

const router = Router();

// Toutes les routes 2FA nécessitent auth sauf webauthnLoginStart/Finish.
router.get('/2fa/status', requireAuth, twoFactorController.get2FAStatus);
router.post('/2fa/totp/setup', requireAuth, twoFactorController.setupTOTP);
router.post('/2fa/totp/enable', requireAuth, validate({ body: enableTOTPSchema }), twoFactorController.enableTOTPHandler);
router.post('/2fa/disable', requireAuth, validate({ body: disable2FASchema }), twoFactorController.disable2FAHandler);

// WebAuthn — enregistrement (auth requis).
router.post('/2fa/webauthn/register/start', requireAuth, twoFactorController.webauthnRegisterStart);
router.post('/2fa/webauthn/register/finish', requireAuth, validate({ body: webauthnResponseSchema }), twoFactorController.webauthnRegisterFinish);

// WebAuthn — login (pas d'auth, mais email requis pour identifier l'utilisateur).
const webauthnLoginStartSchema = z.object({ email: z.string().email() });
const webauthnLoginFinishSchema = z.object({
  email: z.string().email(),
  response: z.record(z.string(), z.unknown()),
});

router.post('/2fa/webauthn/login/start', validate({ body: webauthnLoginStartSchema }), twoFactorController.webauthnLoginStart);
router.post('/2fa/webauthn/login/finish', validate({ body: webauthnLoginFinishSchema }), twoFactorController.webauthnLoginFinish);

export const twoFactorRoutes = router;
