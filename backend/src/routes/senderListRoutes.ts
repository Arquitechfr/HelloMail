import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as senderListController from '../controllers/senderListController.js';

const router = Router();

// Toutes les routes de gestion des listes d'expéditeurs sont authentifiées
router.use(requireAuth);

router.get('/', senderListController.list);
router.post('/', senderListController.create);
router.get('/check', senderListController.check);
router.delete('/:id', senderListController.remove);

export { router as senderListRoutes };
