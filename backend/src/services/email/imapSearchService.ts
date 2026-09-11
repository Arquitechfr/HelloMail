import type { ImapFlow, SearchObject } from 'imapflow';
import type { IAccountDocument } from '../../models/Account.js';
import { MessageModel } from '../../models/Message.js';
import { logger } from '../../config/logger.js';
import { imapPool } from './imapPool.js';
import { mapFetchResultToMessage } from '../sync/messageMapper.js';
import { parseSearchQuery, type SearchQuery } from './searchService.js';

/** Nombre max d'UID rapatriés par recherche serveur (borne de coût). */
const MAX_SERVER_RESULTS = 200;

const FETCH_QUERY = {
  uid: true,
  envelope: true,
  flags: true,
  bodyStructure: true,
  size: true,
} as const;

/**
 * Recherche côté serveur IMAP (fallback de la recherche MongoDB locale).
 *
 * Traduit les filtres de `SearchQuery` en critères `client.search()` IMAP,
 * rapatrie les envelopes des messages trouvés (discipline PEEK : uniquement
 * envelope/flags/bodyStructure/size — jamais le corps) et les upserte en base.
 * La requête MongoDB locale est ensuite rejouée par l'appelant : les critères
 * serveur sont volontairement un surensemble (le re-filtrage local fait foi).
 *
 * @returns Le nombre de messages importés en base.
 */
export async function importSearchResultsFromServer(
  account: IAccountDocument,
  query: SearchQuery,
): Promise<number> {
  const accountId = String(account._id);
  const folder = query.folder ?? 'INBOX';
  const client = await imapPool.acquire(account);

  try {
    // Lecture seule : la recherche ne doit jamais toucher les flags.
    await client.mailboxOpen(folder, { readOnly: true });

    const criteria = buildImapCriteria(query);
    const uids = await runSearch(client, criteria);

    if (!uids || uids.length === 0) {
      return 0;
    }

    // IMAP retourne les UID en ordre croissant — on borne aux plus récents.
    const selected = uids.slice(-MAX_SERVER_RESULTS);

    let imported = 0;
    for await (const msg of client.fetch(selected, FETCH_QUERY, { uid: true })) {
      try {
        const messageInput = mapFetchResultToMessage(accountId, folder, msg);
        await MessageModel.updateOne(
          { accountId, folder: messageInput.folder, uid: messageInput.uid },
          { $set: messageInput },
          { upsert: true },
        );
        imported++;
      } catch (error) {
        logger.error(
          { accountId, folder, uid: msg.uid, error: error instanceof Error ? error.message : 'erreur inconnue' },
          'Erreur import résultat de recherche serveur',
        );
      }
    }

    logger.info({ accountId, folder, imported }, 'Recherche serveur : résultats importés');
    return imported;
  } finally {
    imapPool.release(accountId);
  }
}

/**
 * Indique si la recherche locale doit être étendue au serveur IMAP :
 * critères présents et résultats locaux insuffisants pour la page demandée.
 */
export function shouldSearchServer(query: SearchQuery, localTotal: number): boolean {
  const hasCriteria = Boolean(
    query.q ||
      query.from ||
      query.to ||
      query.subject ||
      query.seen !== undefined ||
      query.flagged !== undefined ||
      query.hasAttachments !== undefined ||
      query.since ||
      query.before,
  );
  if (!hasCriteria) {
    return false;
  }

  // Aucun résultat local, ou la page demandée dépasse le périmètre local.
  return localTotal === 0 || localTotal <= (query.page - 1) * query.limit;
}

/** Traduit les filtres SearchQuery en critères ImapFlow `client.search()`. */
function buildImapCriteria(query: SearchQuery): SearchObject {
  const parsed = parseSearchQuery(query.q);
  const filters = { ...parsed.filters };

  // Les filtres explicites priment sur les opérateurs parsés de q.
  if (query.from) filters.from = query.from;
  if (query.to) filters.to = query.to;
  if (query.subject) filters.subject = query.subject;
  if (query.seen !== undefined) filters.seen = query.seen;
  if (query.flagged !== undefined) filters.flagged = query.flagged;
  if (query.since) filters.since = query.since;
  if (query.before) filters.before = query.before;

  const criteria: Record<string, unknown> = {};

  if (filters.from) criteria.from = filters.from;
  if (filters.to) criteria.to = filters.to;
  if (filters.subject) criteria.subject = filters.subject;
  if (filters.seen !== undefined) criteria.seen = filters.seen;
  if (filters.flagged !== undefined) criteria.flagged = filters.flagged;
  if (filters.since) criteria.since = filters.since;
  if (filters.before) criteria.before = filters.before;
  // `text` couvre en-têtes + corps — équivalent le plus proche du $text Mongo.
  if (parsed.textQuery) criteria.text = parsed.textQuery;
  // `hasAttachments` n'a pas d'équivalent SEARCH — le filtre local re-trie.

  return criteria as SearchObject;
}

/**
 * Exécute `client.search()`. Si le critère `text` n'est pas supporté par le
 * serveur (BAD/NO), retente sans — le re-filtrage MongoDB local fait foi.
 */
async function runSearch(client: ImapFlow, criteria: SearchObject): Promise<number[] | false> {
  try {
    return await client.search(criteria, { uid: true });
  } catch (error) {
    if (!('text' in criteria)) {
      throw error;
    }
    logger.warn(
      { error: error instanceof Error ? error.message : 'erreur inconnue' },
      'Critère TEXT non supporté par le serveur, recherche dégradée',
    );
    const degraded = { ...criteria } as Record<string, unknown>;
    delete degraded.text;
    return client.search(degraded as SearchObject, { uid: true });
  }
}
