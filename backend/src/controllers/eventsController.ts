import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { subscribeToUserEvents } from '../services/realtime/eventSubscriber.js';
import { logger } from '../config/logger.js';

/**
 * Endpoint SSE (Server-Sent Events) pour les notifications temps réel.
 *
 * - Headers SSE : text/event-stream, no-cache/no-transform, X-Accel-Buffering.
 *   NB : pas de `Connection: keep-alive` manuel — header hop-by-hop interdit en
 *   HTTP/2 (RFC 9113 §8.2.2), Node gère déjà le keep-alive en HTTP/1.1.
 * - Heartbeat toutes les 30s pour maintenir la connexion.
 * - Souscrit aux événements de l'utilisateur authentifié.
 * - Cleanup sur déconnexion du client (req.on('close')).
 *
 * Auth via query param `token` (EventSource ne supporte pas les headers custom).
 */
export const eventsController = {
  sseStream: asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Headers SSE.
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Envoie un événement initial de confirmation.
    res.write('event: connected\ndata: {"status":"connected"}\n\n');

    // Heartbeat toutes les 30s pour maintenir la connexion.
    const heartbeat = setInterval(() => {
      res.write(': ping\n\n');
    }, 30_000);

    // Souscrit aux événements de l'utilisateur.
    const unsubscribe = subscribeToUserEvents(req.user.id, (event) => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    });

    logger.info({ userId: req.user.id }, 'Connexion SSE établie');

    // Cleanup quand le client se déconnecte.
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      logger.info({ userId: req.user.id }, 'Connexion SSE fermée');
    });
  }),
};
