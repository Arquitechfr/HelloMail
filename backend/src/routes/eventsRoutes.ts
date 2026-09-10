import { Router } from 'express';
import { eventsController } from '../controllers/eventsController.js';
import { requireAuthSse } from '../middleware/auth.js';

const router = Router();

// Connexion SSE pour les notifications temps réel.
// Auth via query param `token` (EventSource ne supporte pas les headers custom).
router.get('/events', requireAuthSse, eventsController.sseStream);

export const eventsRoutes = router;
