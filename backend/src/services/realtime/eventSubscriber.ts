import Redis from 'ioredis';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { EVENTS_CHANNEL, type RealtimeEvent } from './eventPublisher.js';

type EventCallback = (event: RealtimeEvent) => void;

let subscriber: Redis | null = null;
const userCallbacks = new Map<string, Set<EventCallback>>();

/**
 * Retourne le subscriber Redis (singleton, connexion lazy).
 *
 * Une seule connexion par process API — Redis recommande une connexion
 * dédiée au subscribe (une connexion en mode subscribe ne peut pas publier).
 */
function getSubscriber(): Redis | null {
  if (env.NODE_ENV === 'test') {
    return null;
  }

  if (!subscriber) {
    subscriber = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => Math.min(times * 500, 2000),
    });

    subscriber.on('error', (error) => {
      logger.error({ error: error.message }, 'Erreur Redis subscriber');
    });

    subscriber.subscribe(EVENTS_CHANNEL);
    subscriber.on('message', (_channel: string, message: string) => {
      try {
        const event = JSON.parse(message) as RealtimeEvent;
        const callbacks = userCallbacks.get(event.userId);
        if (callbacks) {
          for (const cb of callbacks) {
            cb(event);
          }
        }
      } catch (error) {
        logger.warn(
          { error: error instanceof Error ? error.message : 'erreur inconnue' },
          'Échec parsing événement Redis',
        );
      }
    });
  }

  return subscriber;
}

/**
 * Souscrit aux événements temps réel d'un utilisateur spécifique.
 *
 * Le filtrage par `userId` se fait côté API (le channel Redis est global).
 * Retourne une fonction de désinscription à appeler quand le client SSE
 * se déconnecte.
 */
export function subscribeToUserEvents(userId: string, callback: EventCallback): () => void {
  getSubscriber();

  let callbacks = userCallbacks.get(userId);
  if (!callbacks) {
    callbacks = new Set();
    userCallbacks.set(userId, callbacks);
  }
  callbacks.add(callback);

  // Retourne la fonction de désinscription.
  return () => {
    const cbs = userCallbacks.get(userId);
    if (cbs) {
      cbs.delete(callback);
      if (cbs.size === 0) {
        userCallbacks.delete(userId);
      }
    }
  };
}

/**
 * Ferme la connexion du subscriber (à appeler au shutdown de l'API).
 */
export async function closeSubscriber(): Promise<void> {
  if (subscriber) {
    await subscriber.quit();
    subscriber = null;
    userCallbacks.clear();
  }
}
