import { Router } from 'express';
import * as oauthController from '../controllers/oauthController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Démarre le flow OAuth Google — redirige vers Google.
// RequireAuth : l'utilisateur doit être connecté pour lier un compte Google.
router.get('/google', requireAuth, oauthController.googleRedirect);

// Callback Google après autorisation — pas de requireAuth (state JWT vérifie l'userId).
router.get('/google/callback', oauthController.googleCallback);

// Démarre le flow OAuth Microsoft — redirige vers Microsoft.
router.get('/microsoft', requireAuth, oauthController.microsoftRedirect);

// Callback Microsoft après autorisation.
router.get('/microsoft/callback', oauthController.microsoftCallback);

export const oauthRoutes = router;
