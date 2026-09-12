import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  exportProfile,
  previewProfile,
  restoreProfile,
} from '../controllers/profileController.js';

const router = Router();

// Toutes les routes de profil exigent une authentification
router.use(requireAuth);

router.get('/export', exportProfile);
router.post('/preview', previewProfile);
router.post('/restore', restoreProfile);

export default router;
