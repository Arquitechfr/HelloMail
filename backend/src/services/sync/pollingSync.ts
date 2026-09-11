import { ImapFlow } from 'imapflow';
import mongoose from 'mongoose';
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
import { FolderModel } from '../../models/Folder.js';
import type { IAccountDocument } from '../../models/Account.js';

/**
 * 2e connexion IMAP read-only dédiée au polling périodique des dossiers
 * (Sent, Drafts, Trash, Junk, Archive ainsi que tous les dossiers personnalisés).
 * L'IDLE INBOX reste sur la connexion principale du SyncManager — cette 2e connexion
 * évite toute interférence (mailboxOpen change le dossier sélectionné d'ImapFlow).
 *
 * Toutes les POLLING_INTERVAL_MS (60s), parcourt les dossiers découverts :
 *   1. runInitialSyncForFolder (idempotent — ne re-sync que si count IMAP ≠ count DB)
 *   2. reconcileFolder (nettoie les messages supprimés distamment)
 *
 * Publie des événements SSE (message:new / message:deleted) ciblés par dossier.
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
 * Découvre la liste de tous les dossiers à poller :
 * 1. Les dossiers spéciaux résolus via specialFolders.ts
 * 2. Les dossiers personnalisés découverts via client.list() si disponible
 * 3. Les dossiers en cache dans la collection Folder
 * Exclut systématiquement INBOX (géré par IDLE) et les dossiers \Noselect.
 */
async function getFoldersToPoll(
  client: ImapFlow,
  account: IAccountDocument,
): Promise<string[]> {
  const folders = new Set<string>();

  // 1. Dossiers spéciaux
  const specialResolvers = [
    findSentFolder,
    findDraftsFolder,
    findTrashFolder,
    findJunkFolder,
    findArchiveFolder,
  ];

  for (const resolver of specialResolvers) {
    try {
      const path = await resolver(account);
      if (path && path.toUpperCase() !== 'INBOX') {
        folders.add(path);
      }
    } catch {
      // ignore
    }
  }

  // 2. Découverte dynamique via client.list() si supporté
  try {
    if (typeof client.list === 'function') {
      const list = await client.list();
      if (Array.isArray(list)) {
        for (const item of list) {
          // Exclut la boîte de réception (gérée par IDLE) — que ce soit par
          // son nom réservé « INBOX » ou par le flag \Inbox quand le serveur
          // liste un nom localisé (ex. « Boîte de réception » chez Zoho).
          if (!item.path || item.path.toUpperCase() === 'INBOX') continue;
          if (item.specialUse?.toLowerCase() === '\\inbox') continue;
          const flags = item.flags;
          const isNoSelect = flags && (
            (flags instanceof Set && (flags.has('\\Noselect') || flags.has('\\NoSelect'))) ||
            (Array.isArray(flags) && (flags.includes('\\Noselect') || flags.includes('\\NoSelect')))
          );
          if (!isNoSelect) {
            folders.add(item.path);
          }
        }
      }
    }
  } catch (error) {
    logger.debug(
      { accountId: String(account._id), error: error instanceof Error ? error.message : 'erreur inconnue' },
      'client.list() non disponible ou en erreur dans pollingSync',
    );
  }

  // 3. Complément depuis le cache Folder en base si MongoDB est connectée
  try {
    if (mongoose.connection.readyState === 1) {
      const cached = await FolderModel.find({ accountId: account._id }).select('path flags specialUse').lean();
      for (const f of cached) {
        if (!f.path || f.path.toUpperCase() === 'INBOX') continue;
        if (f.specialUse?.toLowerCase() === '\\inbox') continue;
        const flags = f.flags ?? [];
        const isNoSelect = flags.includes('\\Noselect') || flags.includes('\\NoSelect');
        if (!isNoSelect) {
          folders.add(f.path);
        }
      }
    }
  } catch {
    // Si la DB n'est pas dispo en mode test unitaire, on continue avec les dossiers spéciaux
  }

  return Array.from(folders);
}

/**
 * Boucle de polling : parcourt les dossiers découverts toutes les POLLING_INTERVAL_MS.
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
    const folders = await getFoldersToPoll(client, account);

    for (const path of folders) {
      if (stopSignal.aborted) return;

      try {
        // 1. Sync les nouveaux messages (idempotent).
        const synced = await runInitialSyncForFolder(client, accountId, path, userId);
        if (synced > 0) {
          publishEvent({
            type: 'message:new',
            accountId,
            userId,
            payload: { folder: path },
          }).catch(() => {});
        }

        // 2. Réconcilie les suppressions distantes (bornée aux UID connus).
        const deleted = await reconcileFolder(client, accountId, path);
        if (deleted > 0) {
          publishEvent({
            type: 'message:deleted',
            accountId,
            userId,
            payload: { folder: path },
          }).catch(() => {});
        }
      } catch (error) {
        // Une erreur sur un dossier ne stoppe pas le polling des autres.
        logger.warn(
          { accountId, folder: path, error: error instanceof Error ? error.message : 'erreur inconnue' },
          'Échec polling dossier (non bloquant)',
        );
      }
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
