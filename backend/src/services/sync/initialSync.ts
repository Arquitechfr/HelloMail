import type { ImapFlow } from 'imapflow';
import mongoose from 'mongoose';
import { MessageModel } from '../../models/Message.js';
import { FolderSyncStateModel } from '../../models/FolderSyncState.js';
import { INITIAL_SYNC_MESSAGE_COUNT } from '../../config/constants.js';
import { logger } from '../../config/logger.js';
import { mapFetchResultToMessage, type MessageInput } from './messageMapper.js';
import { adjustFolderCounters, setFolderCounts } from '../email/folderCounters.js';
import {
  findSentFolder,
  findTrashFolder,
  findDraftsFolder,
  findJunkFolder,
  findArchiveFolder,
} from '../email/specialFolders.js';
import type { IAccountDocument } from '../../models/Account.js';
import { syncFolderCacheFromClient } from '../email/folderService.js';
import { addSenderContactIfEnabled } from '../contacts/contactService.js';

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
  userId?: string,
): Promise<number> {
  // Ouvre le dossier en read-write (voir AGENTS.md — EXPUNGE nécessite read-write).
  const mailbox = await client.mailboxOpen(folder, { readOnly: false });

  const totalMessages = mailbox.exists;
  // Compteur absolu « messages » du cache Folder (valeur serveur autoritaire).
  setFolderCounts(accountId, folder, { messages: totalMessages }).catch(() => {});
  const uidValidity = String(mailbox.uidValidity ?? '');
  const openedModseq = mailbox.highestModseq;

  const prevState = await FolderSyncStateModel.findOne({ accountId, folder }).lean();

  // uidValidity changé → les UID trackés en base sont obsolètes → purge + resync.
  if (prevState && uidValidity && prevState.uidValidity !== uidValidity) {
    await MessageModel.deleteMany({ accountId, folder });
    logger.info({ accountId, folder }, 'UIDVALIDITY changé, purge et resync du dossier');
  }

  // Delta sync CONDSTORE : si un highestModseq est déjà persisté pour ce
  // dossier, on ne rapatrie que les changements (flags inclus) au lieu de
  // re-fetcher les N derniers messages.
  if (prevState?.highestModseq && prevState.uidValidity === uidValidity) {
    try {
      const delta = await syncFolderDelta(client, accountId, folder, prevState.highestModseq, userId);
      // Sans highestModseq : ne pas écraser le max modseq observé par la delta
      // (qui peut dépasser le modseq d'ouverture de mailbox).
      await saveFolderSyncState(accountId, folder, uidValidity);
      logger.info({ accountId, folder, delta }, 'Delta sync CONDSTORE terminée');
      return delta;
    } catch (error) {
      // CONDSTORE non supporté ou modseq invalide → fallback sur le fetch complet.
      logger.warn(
        { accountId, folder, error: error instanceof Error ? error.message : 'erreur inconnue' },
        'Delta sync impossible, fallback sur la sync classique',
      );
    }
  }

  if (totalMessages === 0) {
    await saveFolderSyncState(accountId, folder, uidValidity, openedModseq);
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
    // Persiste quand même l'état (modseq d'ouverture) pour la delta sync future.
    await saveFolderSyncState(accountId, folder, uidValidity, openedModseq);
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

  // Phase 1 : collecte des messages fetchés (range borné à N).
  // Fetch par numéro de séquence (pas { uid: true } dans les options → range = seq).
  // Le query.uid: true inclut l'UID dans la réponse pour la clé d'upsert.
  const fetched: MessageInput[] = [];
  for await (const msg of client.fetch(range, FETCH_QUERY)) {
    try {
      fetched.push(mapFetchResultToMessage(accountId, folder, msg));
    } catch (error) {
      logger.error(
        { accountId, folder, uid: msg.uid, error: error instanceof Error ? error.message : 'erreur inconnue' },
        'Erreur mapping message',
      );
    }
  }

  // État « lu » antérieur — pour le delta du badge « non lus ».
  // null → lecture impossible : on saute l'ajustement (le refresh TTL corrigera).
  const priorSeen = await fetchPriorSeenMap(accountId, folder, fetched.map((m) => m.uid));
  let unseenDelta = 0;

  // Phase 2 : upserts.
  for (const messageInput of fetched) {
    try {
      await MessageModel.updateOne(
        { accountId, folder: messageInput.folder, uid: messageInput.uid },
        { $set: messageInput },
        { upsert: true },
      );
      if (priorSeen) {
        unseenDelta += unseenDeltaFor(messageInput, priorSeen.get(messageInput.uid));
      }
      if (userId && folder.toUpperCase() === 'INBOX' && messageInput.from.address) {
        addSenderContactIfEnabled(userId, messageInput.from).catch(() => {});
      }
      synced++;
    } catch (error) {
      // Une erreur de fetch/upsert individuel ne doit pas interrompre la boucle.
      logger.error(
        { accountId, folder, uid: messageInput.uid, error: error instanceof Error ? error.message : 'erreur inconnue' },
        'Erreur upsert UID',
      );
    }
  }

  if (unseenDelta !== 0) {
    adjustFolderCounters(accountId, folder, { unseenDelta }).catch(() => {});
  }

  logger.info({ accountId, folder, synced }, 'Sync initiale terminée');

  // Persiste l'état de sync pour permettre la delta sync au prochain cycle.
  await saveFolderSyncState(accountId, folder, uidValidity, openedModseq);

  return synced;
}

/**
 * Delta sync CONDSTORE : ne fetch que les messages dont le modseq a changé
 * depuis la dernière sync connue (nouveaux messages + changements de flags).
 * Persiste le nouveau highestModseq (max vu dans les réponses).
 *
 * @returns Le nombre de messages modifiés/upsertés.
 */
async function syncFolderDelta(
  client: ImapFlow,
  accountId: string,
  folder: string,
  lastModseq: string,
  userId?: string,
): Promise<number> {
  let delta = 0;
  let maxModseq = BigInt(lastModseq);

  // Phase 1 : collecte des changements.
  const changed: MessageInput[] = [];
  for await (const msg of client.fetch('1:*', FETCH_QUERY, {
    uid: true,
    changedSince: BigInt(lastModseq),
  })) {
    try {
      changed.push(mapFetchResultToMessage(accountId, folder, msg));
      if (msg.modseq && msg.modseq > maxModseq) {
        maxModseq = msg.modseq;
      }
    } catch (error) {
      logger.error(
        { accountId, folder, uid: msg.uid, error: error instanceof Error ? error.message : 'erreur inconnue' },
        'Erreur mapping message (delta sync)',
      );
    }
  }

  // État « lu » antérieur — pour le delta du badge « non lus ».
  const priorSeen = await fetchPriorSeenMap(accountId, folder, changed.map((m) => m.uid));
  let unseenDelta = 0;

  // Phase 2 : upserts.
  for (const messageInput of changed) {
    try {
      await MessageModel.updateOne(
        { accountId, folder: messageInput.folder, uid: messageInput.uid },
        { $set: messageInput },
        { upsert: true },
      );
      if (priorSeen) {
        unseenDelta += unseenDeltaFor(messageInput, priorSeen.get(messageInput.uid));
      }
      if (userId && folder.toUpperCase() === 'INBOX' && messageInput.from.address) {
        addSenderContactIfEnabled(userId, messageInput.from).catch(() => {});
      }
      delta++;
    } catch (error) {
      logger.error(
        { accountId, folder, uid: messageInput.uid, error: error instanceof Error ? error.message : 'erreur inconnue' },
        'Erreur upsert UID (delta sync)',
      );
    }
  }

  if (unseenDelta !== 0) {
    adjustFolderCounters(accountId, folder, { unseenDelta }).catch(() => {});
  }

  // Persiste le max modseq réellement observé (plus précis que l'ouverture).
  await FolderSyncStateModel.updateOne(
    { accountId, folder },
    { $set: { highestModseq: maxModseq.toString() } },
  );

  return delta;
}

/**
 * Récupère l'état « lu » antérieur des messages connus en base.
 * Sert à calculer le delta du compteur `unseen` du cache Folder.
 */
async function fetchPriorSeenMap(
  accountId: string,
  folder: string,
  uids: number[],
): Promise<Map<number, boolean> | null> {
  if (uids.length === 0) return new Map();
  try {
    const docs = await MessageModel.find({ accountId, folder, uid: { $in: uids } })
      .select('uid flags.seen')
      .lean();
    return new Map(docs.map((d) => [d.uid, d.flags?.seen === true]));
  } catch (error) {
    logger.warn(
      { accountId, folder, error: error instanceof Error ? error.message : 'erreur inconnue' },
      'Lecture état seen antérieur impossible — ajustement unseen ignoré',
    );
    return null;
  }
}

/**
 * Delta du compteur `unseen` pour un message upserté :
 * - insert (`prevSeen` inconnu) : +1 si non lu ;
 * - mise à jour : ±1 si le flag seen a basculé.
 */
function unseenDeltaFor(message: MessageInput, prevSeen: boolean | undefined): number {
  const seen = message.flags?.seen === true;
  if (prevSeen === undefined) return seen ? 0 : 1;
  if (prevSeen === seen) return 0;
  return seen ? -1 : 1;
}

/** Persiste l'état de sync d'un dossier (uidValidity + highestModseq). */
async function saveFolderSyncState(
  accountId: string,
  folder: string,
  uidValidity: string,
  highestModseq?: bigint,
): Promise<void> {
  await FolderSyncStateModel.updateOne(
    { accountId, folder },
    {
      $set: {
        uidValidity,
        lastSyncAt: new Date(),
        ...(highestModseq !== undefined && { highestModseq: highestModseq.toString() }),
      },
    },
    { upsert: true },
  );
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
  const userId = String(account.userId);

  // 1. INBOX (comportement historique).
  total += await runInitialSyncForFolder(client, accountId, 'INBOX', userId);

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

      // Évite de re-sync INBOX si un fallback specialFolders retourne "INBOX"
      // (insensible à la casse — le nom réservé est case-insensitive, RFC 3501).
      if (path.toUpperCase() === 'INBOX') continue;

      total += await runInitialSyncForFolder(client, accountId, path, userId);
    } catch (error) {
      // Un dossier spécial non syncable ne doit pas bloquer les autres.
      logger.warn(
        { accountId, folder: name, error: error instanceof Error ? error.message : 'erreur inconnue' },
        'Échec sync dossier spécial (non bloquant)',
      );
    }
  }

  // 3. Rafraîchit le cache Folder en base (évite un LIST IMAP côté API).
  //    Best-effort : une erreur ne fait pas échouer la sync.
  try {
    await syncFolderCacheFromClient(client, accountId);
  } catch (error) {
    logger.warn(
      { accountId, error: error instanceof Error ? error.message : 'erreur inconnue' },
      'Échec rafraîchissement cache Folder (non bloquant)',
    );
  }

  // 4. Purge les données stockées sous un alias localisé d'INBOX (ex. Zoho
  //    liste « Boîte de réception » avec flag \Inbox). Le polling historique
  //    pouvait synchroniser le même mailbox sous son nom listé, créant des
  //    doublons de la copie canonique « INBOX ». Données dérivées : la purge
  //    est sans risque, la resync repasse par 'INBOX'.
  try {
    await purgeInboxAliasData(accountId);
  } catch (error) {
    logger.warn(
      { accountId, error: error instanceof Error ? error.message : 'erreur inconnue' },
      'Échec purge alias INBOX localisé (non bloquant)',
    );
  }

  return total;
}

/**
 * Supprime les messages/caches/états stockés sous le path localisé de la
 * boîte de réception (doc Folder avec specialUse '\Inbox' et path ≠ 'INBOX').
 * No-op si l'inbox est listée sous son nom réservé.
 */
async function purgeInboxAliasData(accountId: string): Promise<void> {
  if (mongoose.connection.readyState !== 1) {
    return;
  }
  const { FolderModel } = await import('../../models/Folder.js');
  const { MessageBodyModel } = await import('../../models/MessageBody.js');

  const inboxAlias = await FolderModel.findOne({
    accountId,
    specialUse: /^\\inbox$/i,
    path: { $ne: 'INBOX' },
  })
    .select('path')
    .lean();

  if (!inboxAlias) {
    return;
  }

  const [deletedMessages] = await Promise.all([
    MessageModel.deleteMany({ accountId, folder: inboxAlias.path }),
    MessageBodyModel.deleteMany({ accountId, folder: inboxAlias.path }),
    FolderSyncStateModel.deleteOne({ accountId, folder: inboxAlias.path }),
  ]);

  logger.info(
    { accountId, aliasPath: inboxAlias.path, deleted: deletedMessages.deletedCount },
    'Purge des données sous l\u2019alias localisé d\u2019INBOX',
  );
}
