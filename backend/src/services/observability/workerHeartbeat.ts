import Redis from 'ioredis';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

/**
 * Heartbeat du sync worker, exposé via Redis et lu par `/api/health`.
 *
 * Le worker (process séparé `worker.ts`) écrit une clé `mailora:worker:heartbeat`
 * toutes les 30s avec un TTL de 90s. L'API lit la clé pour exposer l'état du
 * worker : 'running' (clé fraîche), 'stale' (clé absente/expirée),
 * 'unknown' (Redis indisponible ou mode test).
 */

const HEARTBEAT_KEY = 'mailora:worker:heartbeat';
const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TTL_S = 90;

function createRedisClient(label: string): Redis {
  const client = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy: (times) => Math.min(times * 500, 2000),
  });
  client.on('error', (error) => {
    logger.error({ error: error.message }, `Erreur Redis ${label}`);
  });
  return client;
}

// ─── Côté worker : écriture périodique ───────────────────────────────────────

let heartbeatClient: Redis | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;

/**
 * Démarre l'écriture périodique du heartbeat (à appeler dans worker.ts).
 * No-op en mode test (pas de dépendance Redis).
 */
export function startWorkerHeartbeat(): void {
  if (env.NODE_ENV === 'test' || heartbeatTimer) {
    return;
  }

  heartbeatClient = createRedisClient('worker heartbeat');

  const beat = async (): Promise<void> => {
    try {
      await heartbeatClient!.set(HEARTBEAT_KEY, Date.now().toString(), 'EX', HEARTBEAT_TTL_S);
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : 'erreur inconnue' },
        'Échec écriture heartbeat worker (non bloquant)',
      );
    }
  };

  // Premier heartbeat immédiat, puis intervalle régulier.
  beat();
  heartbeatTimer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref();
}

/** Arrête le heartbeat et supprime la clé (shutdown propre du worker). */
export async function stopWorkerHeartbeat(): Promise<void> {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (heartbeatClient) {
    try {
      await heartbeatClient.del(HEARTBEAT_KEY);
      await heartbeatClient.quit();
    } catch {
      // Best-effort — la clé expirera seule via TTL.
    }
    heartbeatClient = null;
  }
}

// ─── Côté API : lecture pour le health check ─────────────────────────────────

let readerClient: Redis | null = null;

export type WorkerStatus = 'running' | 'stale' | 'unknown';

/**
 * Lit le statut du worker pour `/api/health`.
 * 'unknown' en mode test ou si Redis est indisponible.
 */
export async function getWorkerStatus(): Promise<WorkerStatus> {
  if (env.NODE_ENV === 'test') {
    return 'unknown';
  }

  try {
    if (!readerClient) {
      readerClient = createRedisClient('health reader');
    }
    const value = await readerClient.get(HEARTBEAT_KEY);
    return value !== null ? 'running' : 'stale';
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : 'erreur inconnue' },
      'Échec lecture heartbeat worker',
    );
    return 'unknown';
  }
}
