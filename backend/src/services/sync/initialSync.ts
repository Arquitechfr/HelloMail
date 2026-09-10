import type { ImapFlow } from 'imapflow';
import { MessageModel } from '../../models/Message.js';
import { INITIAL_SYNC_MESSAGE_COUNT } from '../../config/constants.js';
import { mapFetchResultToMessage } from './messageMapper.js';

/**
 * Synchronise les 50 derniers messages d'INBOX pour un compte.
 * Idempotente : si des messages existent déjà pour ce compte/dossier, ne rien refaire.
 *
 * Ouvre INBOX en read-write (nécessaire pour les notifications EXPUNGE ultérieures
 * dans la même session — voir services/sync/AGENTS.md).
 *
 * Utilise un fetch par range de séquence calculé depuis `mailbox.exists` plutôt
 * qu'un `SEARCH ALL` — évite de récupérer tous les UID d'une boîte volumineuse
 * (ex: Gmail avec 500k messages) juste pour slicer les 50 derniers.
 *
 * @returns Le nombre de messages synchronisés (upsertés).
 */
export async function runInitialSync(
  client: ImapFlow,
  accountId: string,
): Promise<number> {
  const folder = 'INBOX';

  // Idempotence : si des messages existent déjà, on ne refait pas la sync initiale.
  const existingCount = await MessageModel.countDocuments({ accountId, folder });
  if (existingCount > 0) {
    console.log(
      `[sync] Compte ${accountId} : ${existingCount} messages déjà synchronisés, sync initiale ignorée`,
    );
    return 0;
  }

  // Ouvre INBOX en read-write (voir AGENTS.md — EXPUNGE nécessite read-write).
  const mailbox = await client.mailboxOpen(folder, { readOnly: false });

  const totalMessages = mailbox.exists;
  if (totalMessages === 0) {
    console.log(`[sync] Compte ${accountId} : INBOX vide, aucune sync initiale`);
    return 0;
  }

  // Calcule le range de séquence des N derniers messages.
  // Les numéros de séquence sont contigus de 1 à totalMessages.
  const start = Math.max(1, totalMessages - INITIAL_SYNC_MESSAGE_COUNT + 1);
  const range = `${start}:${totalMessages}`;

  let synced = 0;

  // Fetch par numéro de séquence (pas { uid: true } dans les options → range = seq).
  // Le query.uid: true inclut l'UID dans la réponse pour la clé d'upsert.
  for await (const msg of client.fetch(
    range,
    { uid: true, envelope: true, flags: true, bodyStructure: true, size: true },
  )) {
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
      console.error(
        `[sync] Compte ${accountId} : erreur sur UID ${msg.uid} — ${error instanceof Error ? error.message : 'erreur inconnue'}`,
      );
    }
  }

  console.log(
    `[sync] Compte ${accountId} : ${synced} message(s) synchronisé(s) lors de la sync initiale`,
  );

  return synced;
}
