import type { ImapFlow } from 'imapflow';
import { MessageModel } from '../../models/Message.js';
import { INITIAL_SYNC_MESSAGE_COUNT } from '../../config/constants.js';
import { logger } from '../../config/logger.js';
import { mapFetchResultToMessage } from './messageMapper.js';
import {
  findSentFolder,
  findTrashFolder,
  findDraftsFolder,
  findJunkFolder,
  findArchiveFolder,
} from '../email/specialFolders.js';
import type { IAccountDocument } from '../../models/Account.js';

const FETCH_QUERY = {
  uid: true,
  envelope: true,
  flags: true,
  bodyStructure: true,
  size: true,
} as const;

/**
 * Synchronise les N derniers messages d'un dossier vers MongoDB.
 * Idempotente : si le nombre de messages en base correspond à IMAP, ne rien refaire.
 * Sinon, re-sync les derniers messages pour rattraper les messages manqués.
 *
 * Ouvre le dossier en read-write (nécessaire pour les notifications EXPUNGE ultérieures
 * dans la même session — voir services/sync/AGENTS.md).
 *
 * Utilise un fetch par range de séquence calculé depuis `mailbox.exists` plutôt
 * qu'un `SEARCH ALL` — évite de récupérer tous les UID d'une boîte volumineuse
 * (ex: Gmail avec 500k messages) juste pour slicer les N derniers.
 *
 * @returns Le nombre de messages synchronisés (upsertés).
 */
export async function runInitialSyncForFolder(
  client: ImapFlow,
  accountId: string,
  folder: string,
): Promise<number> {
  // Ouvre le dossier en read-write (voir AGENTS.md — EXPUNGE nécessite read-write).
  const mailbox = await client.mailboxOpen(folder, { readOnly: false });

  const totalMessages = mailbox.exists;
  if (totalMessages === 0) {
    logger.info({ accountId, folder }, 'Dossier vide, aucune sync initiale');
    return 0;
  }

  // Idempotence : si le count IMAP correspond au count DB, on ne refait pas.
  const existingCount = await MessageModel.countDocuments({ accountId, folder });
  if (existingCount === totalMessages) {
    logger.info(
      { accountId, folder, count: existingCount },
      'Messages déjà synchronisés, sync initiale ignorée',
    );
    return 0;
  }

  logger.info(
    { accountId, folder, db: existingCount, imap: totalMessages },
    'Synchronisation initiale',
  );

  // Calcule le range de séquence des N derniers messages.
  // Les numéros de séquence sont contigus de 1 à totalMessages.
  const start = Math.max(1, totalMessages - INITIAL_SYNC_MESSAGE_COUNT + 1);
  const range = `${start}:${totalMessages}`;

  let synced = 0;

  // Fetch par numéro de séquence (pas { uid: true } dans les options → range = seq).
  // Le query.uid: true inclut l'UID dans la réponse pour la clé d'upsert.
  for await (const msg of client.fetch(range, FETCH_QUERY)) {
    try {
      const messageInput = mapFetchResultToMessage(accountId, folder, msg);
      await MessageModel.updateOne(
        { accountId, folder: messageInput.folder, uid: messageInput.uid },
        { $set: messageInput },
        { upsert: true },
      );
      synced++;
    } catch (error) {
      // Une erreur de fetch/upsert individuel ne doit pas interrompre la boucle.
      logger.error(
        { accountId, folder, uid: msg.uid, error: error instanceof Error ? error.message : 'erreur inconnue' },
        'Erreur upsert UID',
      );
    }
  }

  logger.info({ accountId, folder, synced }, 'Sync initiale terminée');

  return synced;
}

/**
 * Synchronise INBOX + tous les dossiers spéciaux détectés (Sent, Drafts, Trash,
 * Junk, Archive) vers MongoDB. Les dossiers spéciaux sont résolus via
 * `specialFolders.findSpecialFolder` (flag specialUse + fallbacks par nom, cache 5 min).
 *
 * L'IDLE reste sur INBOX uniquement — les changements distants sur les autres
 * dossiers ne sont pas temps réel, mais rattrapés à la prochaine reconnexion
 * (sync initiale idempotente).
 *
 * @returns Le nombre total de messages synchronisés (tous dossiers confondus).
 */
export async function runInitialSyncAll(
  client: ImapFlow,
  accountId: string,
  account: IAccountDocument,
): Promise<number> {
  let total = 0;

  // 1. INBOX (comportement historique).
  total += await runInitialSyncForFolder(client, accountId, 'INBOX');

  // 2. Dossiers spéciaux — résolution via specialFolders (cache 5 min, un seul
  //    listFolders sous-jacent). Skip si null (dossier non trouvé sur le serveur).
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
      if (!path) {
        logger.debug({ accountId, folder: name }, 'Dossier spécial non trouvé, sync ignorée');
        continue;
      }

      // Évite de re-sync INBOX si un fallback specialFolders retourne "INBOX".
      if (path === 'INBOX') continue;

      total += await runInitialSyncForFolder(client, accountId, path);
    } catch (error) {
      // Un dossier spécial non syncable ne doit pas bloquer les autres.
      logger.warn(
        { accountId, folder: name, error: error instanceof Error ? error.message : 'erreur inconnue' },
        'Échec sync dossier spécial (non bloquant)',
      );
    }
  }

  return total;
}
