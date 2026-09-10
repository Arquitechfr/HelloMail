import type { ImapFlow } from 'imapflow';
import { logger } from '../../config/logger.js';
import { reconcileFolder } from './reconcileFolder.js';
import {
  findSentFolder,
  findTrashFolder,
  findDraftsFolder,
  findJunkFolder,
  findArchiveFolder,
} from '../email/specialFolders.js';
import type { IAccountDocument } from '../../models/Account.js';

/**
 * Réconcilie INBOX + tous les dossiers spéciaux détectés avec l'état réel d'IMAP.
 *
 * Pour chaque dossier : fetch les UID connus en base, supprime ceux absents d'IMAP
 * (messages supprimés depuis un autre client). Bornée aux UID trackés — pas de
 * SEARCH ALL (voir services/sync/AGENTS.md).
 *
 * À appeler après `runInitialSyncAll` au démarrage du worker pour nettoyer les
 * messages fantômes (supprimés distamment entre deux connexions du worker).
 *
 * @returns Le nombre total de documents supprimés (tous dossiers confondus).
 */
export async function reconcileAllFolders(
  client: ImapFlow,
  accountId: string,
  account: IAccountDocument,
): Promise<number> {
  let totalDeleted = 0;

  // 1. INBOX.
  totalDeleted += await safeReconcile(client, accountId, 'INBOX');

  // 2. Dossiers spéciaux.
  const specialFolders: Array<{ name: string; resolver: (a: IAccountDocument) => Promise<string | null> }> = [
    { name: 'Sent', resolver: findSentFolder },
    { name: 'Drafts', resolver: findDraftsFolder },
    { name: 'Trash', resolver: findTrashFolder },
    { name: 'Junk', resolver: findJunkFolder },
    { name: 'Archive', resolver: findArchiveFolder },
  ];

  for (const { name, resolver } of specialFolders) {
    try {
      const path = await resolver(account);
      if (!path || path === 'INBOX') continue;

      totalDeleted += await safeReconcile(client, accountId, path);
    } catch (error) {
      logger.warn(
        { accountId, folder: name, error: error instanceof Error ? error.message : 'erreur inconnue' },
        'Échec reconciliation dossier spécial (non bloquant)',
      );
    }
  }

  return totalDeleted;
}

/** Wrapper try/catch pour une reconciliation individuelle non bloquante. */
async function safeReconcile(
  client: ImapFlow,
  accountId: string,
  folder: string,
): Promise<number> {
  try {
    return await reconcileFolder(client, accountId, folder);
  } catch (error) {
    logger.warn(
      { accountId, folder, error: error instanceof Error ? error.message : 'erreur inconnue' },
      'Échec reconciliation (non bloquant)',
    );
    return 0;
  }
}
