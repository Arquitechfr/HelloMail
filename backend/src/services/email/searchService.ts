import type { IAccountDocument } from '../../models/Account.js';
import { MessageModel } from '../../models/Message.js';
import { escapeRegExp } from '../../utils/regex.js';

export interface SearchQuery {
  q?: string;
  folder?: string;
  from?: string;
  to?: string;
  subject?: string;
  seen?: boolean;
  flagged?: boolean;
  hasAttachments?: boolean;
  since?: Date;
  before?: Date;
  page: number;
  limit: number;
}

export interface SearchResult {
  data: unknown[];
  page: number;
  limit: number;
  total: number;
  /** 'local' = MongoDB uniquement, 'server' = résultats enrichis via IMAP. */
  source?: 'local' | 'server';
}

export interface ParsedSearch {
  textQuery: string | undefined;
  filters: {
    from?: string;
    to?: string;
    subject?: string;
    seen?: boolean;
    flagged?: boolean;
    isPinned?: boolean;
    tag?: string;
    hasAttachments?: boolean;
    since?: Date;
    before?: Date;
  };
}

/**
 * Parse une requête de recherche avec opérateurs.
 *
 * Opérateurs reconnus (insensibles à la casse) :
 * - `from:alice` → filtre par expéditeur (regex insensible à la casse)
 * - `to:bob` → filtre par destinataire
 * - `subject:test` → filtre par sujet
 * - `is:unread` / `is:read` → filtre par flag seen
 * - `is:flagged` / `is:unflagged` → filtre par flag flagged
 * - `has:attachment` → filtre par hasAttachments
 * - `before:2026-01-01` → filtre par date (avant)
 * - `since:2026-01-01` → filtre par date (depuis)
 *
 * Le texte restant (sans opérateurs) est utilisé comme recherche plein texte ($text).
 */
export function parseSearchQuery(q: string | undefined): ParsedSearch {
  const result: ParsedSearch = { textQuery: undefined, filters: {} };

  if (!q) return result;

  const tokens: string[] = [];
  const parts = q.trim().split(/\s+/);

  for (const part of parts) {
    const colonIdx = part.indexOf(':');
    if (colonIdx <= 0) {
      tokens.push(part);
      continue;
    }

    const operator = part.substring(0, colonIdx).toLowerCase();
    const value = part.substring(colonIdx + 1);

    if (!value) {
      tokens.push(part);
      continue;
    }

    switch (operator) {
      case 'from':
        result.filters.from = value;
        break;
      case 'to':
        result.filters.to = value;
        break;
      case 'subject':
        result.filters.subject = value;
        break;
      case 'is':
        if (value === 'unread') result.filters.seen = false;
        else if (value === 'read') result.filters.seen = true;
        else if (value === 'flagged') result.filters.flagged = true;
        else if (value === 'unflagged') result.filters.flagged = false;
        else if (value === 'pinned') result.filters.isPinned = true;
        else if (value === 'unpinned') result.filters.isPinned = false;
        else tokens.push(part);
        break;
      case 'tag':
        result.filters.tag = value;
        break;
      case 'has':
        if (value === 'attachment' || value === 'attachments') {
          result.filters.hasAttachments = true;
        } else {
          tokens.push(part);
        }
        break;
      case 'before': {
        const date = new Date(value);
        if (!isNaN(date.getTime())) result.filters.before = date;
        else tokens.push(part);
        break;
      }
      case 'since': {
        const date = new Date(value);
        if (!isNaN(date.getTime())) result.filters.since = date;
        else tokens.push(part);
        break;
      }
      default:
        tokens.push(part);
    }
  }

  if (tokens.length > 0) {
    result.textQuery = tokens.join(' ');
  }

  return result;
}

/**
 * Recherche des messages dans la base MongoDB.
 *
 * Combine la recherche plein texte ($text sur l'index textuel) avec des
 * filtres structurés (folder, from, to, subject, seen, flagged, hasAttachments,
 * dateRange). Les opérateurs de `q` sont parsés par `parseSearchQuery`.
 *
 * Les filtres explicites passés en paramètres (from, to, etc.) sont fusionnés
 * avec ceux parsés de `q` — les filtres explicites priment.
 */
export async function searchMessages(
  account: IAccountDocument,
  query: SearchQuery,
): Promise<SearchResult> {
  const accountId = String(account._id);
  const parsed = parseSearchQuery(query.q);

  // Fusionne les filtres explicites avec ceux parsés de q (les explicites priment).
  const filters = { ...parsed.filters };
  if (query.from) filters.from = query.from;
  if (query.to) filters.to = query.to;
  if (query.subject) filters.subject = query.subject;
  if (query.seen !== undefined) filters.seen = query.seen;
  if (query.flagged !== undefined) filters.flagged = query.flagged;
  if (query.hasAttachments !== undefined) filters.hasAttachments = query.hasAttachments;
  if (query.since) filters.since = query.since;
  if (query.before) filters.before = query.before;

  // Construit la query MongoDB.
  const mongoQuery: Record<string, unknown> = { accountId };

  // Recherche plein texte si un textQuery est présent.
  if (parsed.textQuery) {
    mongoQuery.$text = { $search: parsed.textQuery };
  }

  // Filtre par dossier.
  if (query.folder) {
    mongoQuery.folder = query.folder;
  }

  // Filtres par expéditeur/destinataire/sujet (regex insensible à la casse et assainie).
  if (filters.from) {
    mongoQuery['from.address'] = { $regex: escapeRegExp(filters.from), $options: 'i' };
  }
  if (filters.to) {
    mongoQuery['to.address'] = { $regex: escapeRegExp(filters.to), $options: 'i' };
  }
  if (filters.subject) {
    mongoQuery.subject = { $regex: escapeRegExp(filters.subject), $options: 'i' };
  }

  // Filtres par flags.
  if (filters.seen !== undefined) {
    mongoQuery['flags.seen'] = filters.seen;
  }
  if (filters.flagged !== undefined) {
    mongoQuery['flags.flagged'] = filters.flagged;
  }
  if (filters.isPinned !== undefined) {
    mongoQuery.isPinned = filters.isPinned;
  }
  if (filters.tag) {
    mongoQuery.tags = filters.tag;
  }
  if (filters.hasAttachments !== undefined) {
    mongoQuery.hasAttachments = filters.hasAttachments;
  }

  // Filtre par plage de dates.
  if (filters.since || filters.before) {
    const dateFilter: Record<string, Date> = {};
    if (filters.since) dateFilter.$gte = filters.since;
    if (filters.before) dateFilter.$lte = filters.before;
    mongoQuery.date = dateFilter;
  }

  const skip = (query.page - 1) * query.limit;

  // Tri : par score textuel si $text présent, sinon par date décroissante.
  const sort = parsed.textQuery ? { score: { $meta: 'textScore' as const } } : { date: -1 };

  const [messages, total] = await Promise.all([
    MessageModel.find(mongoQuery).sort(sort as never).skip(skip).limit(query.limit).lean(),
    MessageModel.countDocuments(mongoQuery),
  ]);

  return {
    data: messages,
    page: query.page,
    limit: query.limit,
    total,
  };
}
