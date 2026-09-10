import type { ImapFlow } from 'imapflow';
import type { IAccountDocument } from '../../models/Account.js';
import { MessageModel } from '../../models/Message.js';
import { INITIAL_SYNC_MESSAGE_COUNT } from '../../config/constants.js';
import { logger } from '../../config/logger.js';
import { imapPool } from './imapPool.js';
import { mapFetchResultToMessage } from '../sync/messageMapper.js';

const FETCH_QUERY = {
  uid: true,
  envelope: true,
  flags: true,
  bodyStructure: true,
  size: true,
} as const;

export interface FetchMoreResult {
  fetched: number;
}

/**
 * Fetch les messages plus anciens (par UID décroissant) depuis IMAP et les
 * upsert en base. Appelé quand l'utilisateur scroll au-delà des messages
 * stockés (pagination arrière — dette D6).
 *
 * Stratégie :
 * 1. Trouve le `uid` le plus bas en base pour `{ accountId, folder }`.
 * 2. Si aucun message en base → fallback : fetch les N derniers (comportement initialSync).
 * 3. Sinon → search les UID plus anciens (`uid: 1:<lowestUid - 1>`).
 * 4. Prend les N plus récents parmi les résultats (UID décroissant).
 * 5. Fetch ces UID (envelope, flags, bodyStructure, size) + upsert idempotent.
 *
 * Discipline PEEK maintenue (envelope/flags/bodyStructure/size — pas de corps).
 * Ouvre le dossier en readOnly pour préserver `\Seen`.
 */
export async function fetchMoreMessages(
  account: IAccountDocument,
  folder: string,
  count = INITIAL_SYNC_MESSAGE_COUNT,
): Promise<FetchMoreResult> {
  const accountId = String(account._id);
  const client = await imapPool.acquire(account);

  try {
    const mailbox = await client.mailboxOpen(folder, { readOnly: true });

    // 1. Trouve le UID le plus bas en base.
    const oldestMessage = await MessageModel.findOne({ accountId, folder })
      .sort({ uid: 1 })
      .select('uid')
      .lean();

    let uidsToFetch: number[];

    if (!oldestMessage) {
      // 2. Fallback : aucun message en base → fetch les N derniers par séquence.
      const totalMessages = mailbox.exists ?? 0;
      if (totalMessages === 0) {
        return { fetched: 0 };
      }
      const start = Math.max(1, totalMessages - count + 1);
      const range = `${start}:${totalMessages}`;
      uidsToFetch = await fetchUidsByRange(client, range);
    } else {
      // 3. Search les UID plus anciens que le plus bas en base.
      const lowestUid = oldestMessage.uid;
      if (lowestUid <= 1) {
        // Pas de messages plus anciens.
        return { fetched: 0 };
      }
      const uidRange = `1:${lowestUid - 1}`;
      const olderUids = await searchUidsByRange(client, uidRange);

      if (olderUids.length === 0) {
        return { fetched: 0 };
      }

      // 4. Prend les N plus récents (UID décroissant).
      olderUids.sort((a, b) => b - a);
      uidsToFetch = olderUids.slice(0, count);
    }

    if (uidsToFetch.length === 0) {
      return { fetched: 0 };
    }

    // 5. Fetch + upsert.
    let fetched = 0;
    for await (const msg of client.fetch(uidsToFetch, FETCH_QUERY, { uid: true })) {
      try {
        const messageInput = mapFetchResultToMessage(accountId, folder, msg);
        await MessageModel.updateOne(
          { accountId, folder: messageInput.folder, uid: messageInput.uid },
          { $set: messageInput },
          { upsert: true },
        );
        fetched++;
      } catch (error) {
        logger.error(
          { accountId, folder, uid: msg.uid, error: error instanceof Error ? error.message : 'erreur inconnue' },
          'Erreur upsert UID (fetchMore)',
        );
      }
    }

    logger.info({ accountId, folder, fetched }, 'Fetch-more terminé');
    return { fetched };
  } finally {
    imapPool.release(accountId);
  }
}

/**
 * Récupère les UID d'un range de séquence via fetch (retourne les UID).
 */
async function fetchUidsByRange(client: ImapFlow, range: string): Promise<number[]> {
  const uids: number[] = [];
  for await (const msg of client.fetch(range, { uid: true })) {
    if (msg.uid) uids.push(msg.uid);
  }
  return uids;
}

/**
 * Recherche les UID dans un range donné via IMAP SEARCH.
 */
async function searchUidsByRange(client: ImapFlow, uidRange: string): Promise<number[]> {
  try {
    const result = await client.search({ uid: uidRange }, { uid: true });
    return Array.isArray(result) ? result : [];
  } catch {
    // Certains serveurs IMAP peuvent rejeter un range vide ou invalide.
    return [];
  }
}
