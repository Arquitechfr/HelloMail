import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as pgpController from '../controllers/pgpController.js';

const router = Router();

// Toutes les routes PGP nécessitent d'être authentifié
router.use(requireAuth);

// Clés personnelles de l'utilisateur
router.get('/keys/me', pgpController.getMyKeys);
router.post('/keys/me', pgpController.saveMyKey);
router.delete('/keys/me/:keyId', pgpController.deleteMyKey);

// Clés publiques des correspondants
router.get('/keys/contacts', pgpController.listContactKeys);
router.get('/keys/contacts/:email', pgpController.getContactKey);
router.post('/keys/contacts', pgpController.saveContactKey);
router.delete('/keys/contacts/:keyId', pgpController.deleteContactKey);

export default router;
