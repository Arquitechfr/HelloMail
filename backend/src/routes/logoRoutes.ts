import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getLogoHandler } from '../controllers/logoController.js';

const router = Router();

// Route publique de récupération de logo avec mise en cache HTTP et double couche mémoire/Redis.
// Permet le chargement direct via les balises <img> et <AvatarImage> du frontend sans Authorization header.
router.get('/:domain', asyncHandler(getLogoHandler));

export default router;
