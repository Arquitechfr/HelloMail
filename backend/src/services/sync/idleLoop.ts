import type { ImapFlow, ExistsEvent, ExpungeEvent, FlagsEvent } from 'imapflow';
import { env } from '../../config/env.js';
import { MessageModel } from '../../models/Message.js';
import { mapFetchResultToMessage } from './messageMapper.js';
import { reconcileFolder } from './reconcileFolder.js';

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
 */
export async function runIdleLoop(
  client: ImapFlow,
  accountId: string,
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
    console.log(`[sync] Compte ${accountId} : boucle IDLE terminée (${reason})`);
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
        } catch (error) {
          console.error(
            `[sync] Compte ${accountId} : erreur upsert UID ${msg.uid} — ${error instanceof Error ? error.message : 'erreur inconnue'}`,
          );
        }
      }
    } catch (error) {
      console.error(
        `[sync] Compte ${accountId} : erreur fetch nouveaux messages (${range}) — ${error instanceof Error ? error.message : 'erreur inconnue'}`,
      );
    }
  };

  // --- Listener: expunge (suppression) ---
  const onExpunge = async (data: ExpungeEvent): Promise<void> => {
    if (data.uid) {
      try {
        await MessageModel.deleteOne({ accountId, folder, uid: data.uid });
        if (env.NODE_ENV !== 'production') {
          console.log(
            `[sync] Compte ${accountId} : message UID ${data.uid} supprimé (expunge)`,
          );
        }
      } catch (error) {
        console.error(
          `[sync] Compte ${accountId} : erreur suppression UID ${data.uid} — ${error instanceof Error ? error.message : 'erreur inconnue'}`,
        );
      }
    } else {
      // Expunge sans UID (serveur sans QRESYNC) → reconciliation bornée.
      try {
        await reconcileFolder(client, accountId, folder);
      } catch (error) {
        console.error(
          `[sync] Compte ${accountId} : erreur reconciliation expunge — ${error instanceof Error ? error.message : 'erreur inconnue'}`,
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
            console.warn(
              `[sync] Compte ${accountId} : flags event seq ${data.seq} sans UID récupérable, ignoré`,
            );
          }
          return;
        }
        uid = msg.uid;
      }

      const flagsSet = data.flags ?? new Set<string>();
      await MessageModel.updateOne(
        { accountId, folder, uid },
        {
          $set: {
            flags: {
              seen: flagsSet.has('\\Seen'),
              answered: flagsSet.has('\\Answered'),
              flagged: flagsSet.has('\\Flagged'),
            },
          },
        },
      );
    } catch (error) {
      console.error(
        `[sync] Compte ${accountId} : erreur maj flags seq ${data.seq} — ${error instanceof Error ? error.message : 'erreur inconnue'}`,
      );
    }
  };

  // --- Listeners de fin de connexion ---
  const onClose = (): void => endLoop('connexion fermée');
  const onError = (err: Error): void => {
    console.error(`[sync] Compte ${accountId} : erreur connexion IMAP — ${err.message}`);
    endLoop('erreur connexion');
  };
  const onAbort = (): void => endLoop('stop signal');

  client.on('exists', onExists);
  client.on('expunge', onExpunge);
  client.on('flags', onFlags);
  client.on('close', onClose);
  client.on('error', onError);
  stopSignal.addEventListener('abort', onAbort);

  console.log(`[sync] Compte ${accountId} : boucle IDLE démarrée sur ${folder}`);

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
