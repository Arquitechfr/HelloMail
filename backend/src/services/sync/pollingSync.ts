import { ImapFlow } from 'imapflow';
import { logger } from '../../config/logger.js';
import { POLLING_INTERVAL_MS, SYNC_BACKOFF_BASE_MS, SYNC_BACKOFF_MAX_MS } from '../../config/constants.js';
import { runInitialSyncForFolder } from './initialSync.js';
import { reconcileFolder } from './reconcileFolder.js';
import { publishEvent } from '../realtime/eventPublisher.js';
import { getImapAuth } from '../auth/oauthService.js';
import {
  findSentFolder,
  findTrashFolder,
  findDraftsFolder,
  findJunkFolder,
  findArchiveFolder,
} from '../email/specialFolders.js';
import type { IAccountDocument } from '../../models/Account.js';

/**
 * 2e connexion IMAP read-only dédiée au polling périodique des dossiers
 * spéciaux (Sent, Drafts, Trash, Junk, Archive). L'IDLE INBOX reste sur la
 * connexion principale du SyncManager — cette 2e connexion évite toute
 * interférence (mailboxOpen change le dossier sélectionné d'ImapFlow).
 *
 * Toutes les POLLING_INTERVAL_MS (60s), parcourt les dossiers spéciaux :
 *   1. runInitialSyncForFolder (idempotent — ne re-sync que si count IMAP ≠ count DB)
 *   2. reconcileFolder (nettoie les messages supprimés distamment)
 *
 * Publie des événements SSE (message:new / message:deleted) si changements.
 * Reconnexion automatique avec backoff si la connexion se ferme.
 */
export async function startPollingSync(
  account: IAccountDocument,
  stopSignal: AbortSignal,
): Promise<void> {
  const accountId = String(account._id);
  const userId = String(account.userId);
  let consecutiveErrors = 0;

  while (!stopSignal.aborted) {
    let client: ImapFlow | null = null;

    try {
      client = await connectPollingClient(account);
      consecutiveErrors = 0;
      logger.info({ accountId }, 'Connexion polling multi-dossiers établie');

      // Boucle de polling — tourne tant que la connexion est active et non abortée.
      await pollLoop(client, account, accountId, userId, stopSignal);

      if (stopSignal.aborted) break;

      // La boucle de polling s'est terminée sans abort → connexion perdue.
      throw new Error('Boucle polling terminée sans stop volontaire');
    } catch (error) {
      if (stopSignal.aborted) break;

      consecutiveErrors++;
      const errorMsg = error instanceof Error ? error.message : 'erreur inconnue';
      logger.warn({ accountId, errors: consecutiveErrors, error: errorMsg }, 'Échec polling multi-dossiers');

      if (client) {
        try {
          await client.logout();
        } catch {
          // Connexion déjà fermée — ignore.
        }
      }

      // Backoff exponentiel : base * 2^(errors-1), plafonné à max.
      const backoffMs = Math.min(
        SYNC_BACKOFF_BASE_MS * Math.pow(2, consecutiveErrors - 1),
        SYNC_BACKOFF_MAX_MS,
      );
      await sleep(backoffMs, stopSignal);
    }
  }
}

/**
 * Crée et connecte une 2e connexion ImapFlow read-only pour le polling.
 * disableAutoIdle: true — pas d'IDLE sur cette connexion (polling actif).
 */
async function connectPollingClient(account: IAccountDocument): Promise<ImapFlow> {
  if (!account.imapConfig?.host) {
    throw new Error('Configuration IMAP manquante pour ce compte');
  }

  const auth = await getImapAuth(account);

  const client = new ImapFlow({
    host: account.imapConfig.host,
    port: account.imapConfig.port,
    secure: account.imapConfig.secure,
    auth,
    logger: false,
    disableAutoIdle: true,
  });

  await client.connect();
  return client;
}

/**
 * Boucle de polling : parcourt les dossiers spéciaux toutes les POLLING_INTERVAL_MS.
 * Se termine quand stopSignal est aborté ou que la connexion se ferme/erre.
 */
async function pollLoop(
  client: ImapFlow,
  account: IAccountDocument,
  accountId: string,
  userId: string,
  stopSignal: AbortSignal,
): Promise<void> {
  while (!stopSignal.aborted) {
    let syncedTotal = 0;
    let deletedTotal = 0;

    const specialFolders: Array<{ name: string; resolver: (a: IAccountDocument) => Promise<string | null> }> = [
      { name: 'Sent', resolver: findSentFolder },
      { name: 'Drafts', resolver: findDraftsFolder },
      { name: 'Trash', resolver: findTrashFolder },
      { name: 'Junk', resolver: findJunkFolder },
      { name: 'Archive', resolver: findArchiveFolder },
    ];

    for (const { name, resolver } of specialFolders) {
      if (stopSignal.aborted) return;

      try {
        const path = await resolver(account);
        if (!path || path === 'INBOX') continue;

        // 1. Sync les nouveaux messages (idempotent).
        const synced = await runInitialSyncForFolder(client, accountId, path);
        syncedTotal += synced;

        // 2. Réconcilie les suppressions distantes (bornée aux UID connus).
        const deleted = await reconcileFolder(client, accountId, path);
        deletedTotal += deleted;
      } catch (error) {
        // Une erreur sur un dossier ne stoppe pas le polling des autres.
        logger.warn(
          { accountId, folder: name, error: error instanceof Error ? error.message : 'erreur inconnue' },
          'Échec polling dossier spécial (non bloquant)',
        );
      }
    }

    // Publie des événements SSE si des changements ont été détectés.
    if (syncedTotal > 0) {
      publishEvent({
        type: 'message:new',
        accountId,
        userId,
        payload: { folder: 'special' },
      }).catch(() => {});
    }
    if (deletedTotal > 0) {
      publishEvent({
        type: 'message:deleted',
        accountId,
        userId,
        payload: { folder: 'special' },
      }).catch(() => {});
    }

    if (stopSignal.aborted) return;

    // Attend le prochain cycle (interruptible par stopSignal).
    await sleep(POLLING_INTERVAL_MS, stopSignal);
  }
}

/**
 * Sleep interruptible : se résout immédiatement si stopSignal est aborté.
 */
function sleep(ms: number, stopSignal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (stopSignal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    stopSignal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
