import type { ImapFlow } from 'imapflow';
import { logger } from '../../config/logger.js';
import { MessageModel } from '../../models/Message.js';
import { adjustFolderCounters } from '../email/folderCounters.js';

/**
 * Réconcilie les messages en base avec l'état réel du serveur IMAP.
 *
 * Bornée aux UID connus en base : fetch uniquement les UID stockés pour ce
 * compte/dossier, identifie ceux absents de la réponse serveur, les supprime.
 * **Pas de SEARCH ALL** — le coût est proportionnel au nombre de messages trackés,
 * pas à la taille totale de la boîte. Voir services/sync/AGENTS.md.
 *
 * @returns Le nombre de documents supprimés de la base.
 */
export async function reconcileFolder(
  client: ImapFlow,
  accountId: string,
  folder: string,
): Promise<number> {
  // Récupère les UID connus en base (+ flags.seen pour les compteurs dossier).
  const knownDocs = await MessageModel.find({ accountId, folder })
    .select('uid flags.seen')
    .lean();

  if (knownDocs.length === 0) {
    return 0;
  }

  const knownUids = knownDocs.map((doc) => doc.uid);

  // Ouvre le dossier en readOnly avant le fetch — le client peut être positionné
  // sur un autre dossier (ex: après runInitialSyncAll qui parcourt plusieurs dossiers).
  // Sans cette ouverture, le fetch UID retournerait des résultats du mauvais dossier.
  await client.mailboxOpen(folder, { readOnly: true });

  // Fetch ces UID sur le serveur pour vérifier lesquels existent encore.
  const returnedUids = new Set<number>();
  for await (const msg of client.fetch(knownUids, { uid: true }, { uid: true })) {
    returnedUids.add(msg.uid);
  }

  // Supprime de la base les UID connus absents de la réponse serveur.
  const missingUids = knownUids.filter((uid) => !returnedUids.has(uid));

  if (missingUids.length === 0) {
    return 0;
  }

  const result = await MessageModel.deleteMany({
    accountId,
    folder,
    uid: { $in: missingUids },
  });

  const missingSet = new Set(missingUids);
  const unreadDeleted = knownDocs.filter(
    (d) => missingSet.has(d.uid) && d.flags?.seen === false,
  ).length;
  adjustFolderCounters(accountId, folder, {
    messagesDelta: -result.deletedCount,
    unseenDelta: -unreadDeleted,
  }).catch(() => {});

  logger.info(
    { accountId, folder, deleted: result.deletedCount },
    'Reconciliation : messages supprimés (absents d\'IMAP)',
  );

  return result.deletedCount;
}
