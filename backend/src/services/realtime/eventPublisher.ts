import Redis from 'ioredis';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

/**
 * Types d'événements temps réel propagés du worker vers le frontend via SSE.
 */
export type RealtimeEventType =
  | 'message:new'
  | 'message:deleted'
  | 'message:flags'
  | 'account:syncError'
  | 'scheduled:sent'
  | 'reminder:triggered'
  | 'reminder:resolved'
  | 'export:progress';

export interface RealtimeEvent {
  type: RealtimeEventType;
  accountId: string;
  userId: string;
  payload: unknown;
}

/** Canal Redis Pub/Sub pour la propagation des événements temps réel. */
export const EVENTS_CHANNEL = 'mailora:events';

let publisher: Redis | null = null;

/**
 * Retourne le publisher Redis (singleton, connexion lazy).
 *
 * En mode test, retourne null — les événements ne sont pas publiés.
 * En production/développement, crée la connexion à la première utilisation.
 */
function getPublisher(): Redis | null {
  if (env.NODE_ENV === 'test') {
    return null;
  }

  if (!publisher) {
    publisher = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => Math.min(times * 500, 2000),
    });

    publisher.on('error', (error) => {
      logger.error({ error: error.message }, 'Erreur Redis publisher');
    });
  }

  return publisher;
}

/**
 * Publie un événement temps réel sur le canal Redis Pub/Sub.
 *
 * Non bloquant : une erreur Redis n'interrompt pas le worker.
 * Les événements ne contiennent jamais de sujet/corps d'email (uniquement
 * UID, folder, flags, errorMsg) — conforme à la discipline de logs du sync.
 */
export async function publishEvent(event: RealtimeEvent): Promise<void> {
  const redis = getPublisher();
  if (!redis) return;

  try {
    await redis.publish(EVENTS_CHANNEL, JSON.stringify(event));
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : 'erreur inconnue' },
      'Échec publication événement temps réel (non bloquant)',
    );
  }
}

/**
 * Ferme la connexion du publisher (à appeler au shutdown du worker).
 */
export async function closePublisher(): Promise<void> {
  if (publisher) {
    await publisher.quit();
    publisher = null;
  }
}
