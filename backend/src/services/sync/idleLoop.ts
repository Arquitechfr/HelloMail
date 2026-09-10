import type { ImapFlow, ExistsEvent, ExpungeEvent, FlagsEvent } from 'imapflow';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { MessageModel } from '../../models/Message.js';
import { mapFetchResultToMessage } from './messageMapper.js';
import { reconcileFolder } from './reconcileFolder.js';
import { publishEvent } from '../realtime/eventPublisher.js';

const FETCH_QUERY = {
  uid: true,
  envelope: true,
  flags: true,
  bodyStructure: true,
  size: true,
} as const;

/**
 * Boucle IDLE : enregistre les listeners sur le client ImapFlow et attend
 * jusqu'à ce que `stopSignal` soit aborté ou que la connexion se ferme/erre.
 *
 * ImapFlow gère l'auto-IDLE : quand un handler exécute une commande (fetch/fetchOne),
 * la lib envoie DONE en interne, exécute la commande, puis re-rentre en IDLE auto
 * après autoIdleDelay. Ne pas improviser ce comportement (voir doc ImapFlow).
 *
 * Les événements temps réel (message:new, message:deleted, message:flags) sont
 * publiés via Redis Pub/Sub pour propagation au frontend via SSE.
 */
export async function runIdleLoop(
  client: ImapFlow,
  accountId: string,
  userId: string,
  folder: string,
  stopSignal: AbortSignal,
): Promise<void> {
  let resolveEnd: () => void;
  const idleEnded = new Promise<void>((resolve) => {
    resolveEnd = resolve;
  });
  let ended = false;

  const endLoop = (reason: string): void => {
    if (ended) return;
    ended = true;
    logger.info({ accountId, reason }, 'Boucle IDLE terminée');
    resolveEnd();
  };

  // --- Listener: exists (nouveaux messages) ---
  const onExists = async (data: ExistsEvent): Promise<void> => {
    if (data.count <= data.prevCount) return;

    const range = `${data.prevCount + 1}:${data.count}`;
    try {
      for await (const msg of client.fetch(range, FETCH_QUERY)) {
        try {
          const messageInput = mapFetchResultToMessage(accountId, folder, msg);
          await MessageModel.updateOne(
            { accountId, folder: messageInput.folder, uid: messageInput.uid },
            { $set: messageInput },
            { upsert: true },
          );
          // Notifie le frontend du nouveau message.
          publishEvent({
            type: 'message:new',
            accountId,
            userId,
            payload: { folder: messageInput.folder, uid: messageInput.uid },
          }).catch(() => {});
        } catch (error) {
          logger.error(
            { accountId, uid: msg.uid, error: error instanceof Error ? error.message : 'erreur inconnue' },
            'Erreur upsert UID',
          );
        }
      }
    } catch (error) {
      logger.error(
        { accountId, range, error: error instanceof Error ? error.message : 'erreur inconnue' },
        'Erreur fetch nouveaux messages',
      );
    }
  };

  // --- Listener: expunge (suppression) ---
  const onExpunge = async (data: ExpungeEvent): Promise<void> => {
    if (data.uid) {
      try {
        await MessageModel.deleteOne({ accountId, folder, uid: data.uid });
        if (env.NODE_ENV !== 'production') {
          logger.info({ accountId, uid: data.uid }, 'Message supprimé (expunge)');
        }
        // Notifie le frontend de la suppression.
        publishEvent({
          type: 'message:deleted',
          accountId,
          userId,
          payload: { folder, uid: data.uid },
        }).catch(() => {});
      } catch (error) {
        logger.error(
          { accountId, uid: data.uid, error: error instanceof Error ? error.message : 'erreur inconnue' },
          'Erreur suppression UID',
        );
      }
    } else {
      // Expunge sans UID (serveur sans QRESYNC) → reconciliation bornée.
      try {
        await reconcileFolder(client, accountId, folder);
      } catch (error) {
        logger.error(
          { accountId, error: error instanceof Error ? error.message : 'erreur inconnue' },
          'Erreur reconciliation expunge',
        );
      }
    }
  };

  // --- Listener: flags (changement de flags) ---
  const onFlags = async (data: FlagsEvent): Promise<void> => {
    try {
      let uid = data.uid;

      if (!uid) {
        // FlagsEvent sans UID : récupérer l'UID via fetchOne par numéro de séquence.
        const msg = await client.fetchOne(data.seq, { uid: true });
        if (!msg || !msg.uid) {
          if (env.NODE_ENV !== 'production') {
            logger.warn({ accountId, seq: data.seq }, 'Flags event sans UID récupérable, ignoré');
          }
          return;
        }
        uid = msg.uid;
      }

      const flagsSet = data.flags ?? new Set<string>();
      const flags = {
        seen: flagsSet.has('\\Seen'),
        answered: flagsSet.has('\\Answered'),
        flagged: flagsSet.has('\\Flagged'),
      };
      await MessageModel.updateOne(
        { accountId, folder, uid },
        { $set: { flags } },
      );
      // Notifie le frontend du changement de flags.
      publishEvent({
        type: 'message:flags',
        accountId,
        userId,
        payload: { folder, uid, flags },
      }).catch(() => {});
    } catch (error) {
      logger.error(
        { accountId, seq: data.seq, error: error instanceof Error ? error.message : 'erreur inconnue' },
        'Erreur maj flags',
      );
    }
  };

  // --- Listeners de fin de connexion ---
  const onClose = (): void => endLoop('connexion fermée');
  const onError = (err: Error): void => {
    logger.error({ accountId, error: err.message }, 'Erreur connexion IMAP');
    endLoop('erreur connexion');
  };
  const onAbort = (): void => endLoop('stop signal');

  client.on('exists', onExists);
  client.on('expunge', onExpunge);
  client.on('flags', onFlags);
  client.on('close', onClose);
  client.on('error', onError);
  stopSignal.addEventListener('abort', onAbort);

  logger.info({ accountId, folder }, 'Boucle IDLE démarrée');

  try {
    await idleEnded;
  } finally {
    // Nettoyage des listeners (évite les fuites sur reconnexion).
    client.off('exists', onExists);
    client.off('expunge', onExpunge);
    client.off('flags', onFlags);
    client.off('close', onClose);
    client.off('error', onError);
    stopSignal.removeEventListener('abort', onAbort);
  }
}
