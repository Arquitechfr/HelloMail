import Redis from 'ioredis';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

/**
 * Lock distribué Redis pour la synchronisation IMAP (risque R5).
 *
 * Empêche deux workers (PM2 multi-instances, redéploiement) de synchroniser
 * le même compte en parallèle. Le lock est posé via `SET key owner NX PX ttl`
 * et renouvelé périodiquement tant que le SyncManager tourne.
 *
 * Fail-open : si Redis est indisponible, on retourne un lock no-op — une panne
 * Redis ne doit pas empêcher la synchronisation (dégradation acceptée, loguée).
 *
 * En mode test, retourne toujours un lock no-op (pas de dépendance Redis).
 */

const LOCK_PREFIX = 'mailora:sync-lock:';
const LOCK_TTL_MS = 120_000;
const RENEW_INTERVAL_MS = 60_000;

/** Identifiant unique de cette instance de worker (hostname + pid + aléa). */
const INSTANCE_ID = `${os.hostname()}:${process.pid}:${randomBytes(4).toString('hex')}`;

export interface SyncLockHandle {
  /** Libère le lock (ne libère que si on en est toujours propriétaire). */
  release(): Promise<void>;
}

let redisClient: Redis | null = null;

function getRedis(): Redis | null {
  if (env.NODE_ENV === 'test') {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => Math.min(times * 500, 2000),
    });

    redisClient.on('error', (error) => {
      logger.error({ error: error.message }, 'Erreur Redis sync lock');
    });
  }

  return redisClient;
}

/** Lock no-op retourné en test ou quand Redis est indisponible (fail-open). */
function noopLock(): SyncLockHandle {
  return { release: async () => {} };
}

/**
 * Tente d'acquérir le lock de sync pour un compte.
 *
 * Retourne un handle si le lock est acquis (ou en mode dégradé no-op),
 * `null` si un autre worker détient déjà le lock.
 *
 * `onLockLost` est appelé si le renouvellement échoue (lock expiré ou volé) —
 * l'appelant doit alors arrêter le SyncManager associé.
 */
export async function acquireSyncLock(
  accountId: string,
  onLockLost?: () => void,
): Promise<SyncLockHandle | null> {
  const redis = getRedis();
  if (!redis) {
    return noopLock();
  }

  const key = `${LOCK_PREFIX}${accountId}`;

  let acquired: string | null;
  try {
    acquired = await redis.set(key, INSTANCE_ID, 'PX', LOCK_TTL_MS, 'NX');
  } catch (error) {
    // Fail-open : Redis down → on démarre quand même (logué).
    logger.warn(
      { accountId, error: error instanceof Error ? error.message : 'erreur inconnue' },
      'Lock Redis indisponible — sync en mode dégradé (sans lock)',
    );
    return noopLock();
  }

  if (acquired !== 'OK') {
    return null;
  }

  // Renouvellement périodique : n'étend le TTL que si on est toujours propriétaire.
  const renewTimer = setInterval(async () => {
    try {
      const renewed = await redis.eval(
        `if redis.call('get', KEYS[1]) == ARGV[1] then
           return redis.call('pexpire', KEYS[1], ARGV[2])
         else
           return 0
         end`,
        1,
        key,
        INSTANCE_ID,
        String(LOCK_TTL_MS),
      );

      if (renewed !== 1) {
        clearInterval(renewTimer);
        logger.warn({ accountId }, 'Lock de sync perdu (expiré ou détenu par un autre worker)');
        onLockLost?.();
      }
    } catch (error) {
      // Erreur transitoire Redis — on retentera au prochain cycle.
      logger.warn(
        { accountId, error: error instanceof Error ? error.message : 'erreur inconnue' },
        'Échec renouvellement lock de sync (réessai au prochain cycle)',
      );
    }
  }, RENEW_INTERVAL_MS);
  renewTimer.unref();

  return {
    release: async () => {
      clearInterval(renewTimer);
      try {
        await redis.eval(
          `if redis.call('get', KEYS[1]) == ARGV[1] then
             return redis.call('del', KEYS[1])
           else
             return 0
           end`,
          1,
          key,
          INSTANCE_ID,
        );
      } catch (error) {
        logger.warn(
          { accountId, error: error instanceof Error ? error.message : 'erreur inconnue' },
          'Échec libération lock de sync (expirera seul via TTL)',
        );
      }
    },
  };
}

/** Ferme la connexion Redis du lock (à appeler au shutdown du worker). */
export async function closeSyncLockRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
