import { Types } from 'mongoose';
import { AccountModel, IAccountDocument } from '../../models/Account.js';
import { MessageModel } from '../../models/Message.js';
import { FolderModel } from '../../models/Folder.js';
import { escapeRegExp } from '../../utils/regex.js';
import { parseSearchQuery } from './searchService.js';

export interface UnifiedSearchOptions {
  q?: string;
  folder?: string;
  accountId?: string;
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
  minSize?: number;
  maxSize?: number;
  includeTrash?: boolean;
  includeJunk?: boolean;
  page?: number;
  limit?: number;
}

export interface UnifiedSearchMessageItem {
  _id: unknown;
  accountId: unknown;
  folder: string;
  uid: number;
  messageId?: string;
  inReplyTo?: string;
  subject: string;
  from: { name?: string; address: string };
  to: Array<{ name?: string; address: string }>;
  date: Date;
  flags: { seen: boolean; answered: boolean; flagged: boolean };
  hasAttachments: boolean;
  size: number;
  tags?: string[];
  snoozedUntil?: Date | null;
  isPinned?: boolean;
  pinnedAt?: Date | null;
  accountColor?: string;
  accountEmail?: string;
  accountName?: string;
}

export interface UnifiedSearchResult {
  data: UnifiedSearchMessageItem[];
  page: number;
  limit: number;
  total: number;
}

const TRASH_FALLBACKS = ['trash', 'corbeille', 'deleted', 'deleted items', 'bin'];
const JUNK_FALLBACKS = ['junk', 'spam', 'junk mail', 'courrier indésirable', 'indésirables'];

/**
 * Recherche fédérée multi-comptes dans les messages synchronisés.
 * Interroge en parallèle tous les comptes actifs (ou un compte ciblé) de l'utilisateur.
 * Exclut par défaut les dossiers Corbeille et Spams sauf si demandé.
 */
export async function searchUnifiedMessages(
  userId: string,
  options: UnifiedSearchOptions,
): Promise<UnifiedSearchResult> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));
  const skip = (page - 1) * limit;

  // 1. Récupération des comptes actifs de l'utilisateur
  const accountQuery: Record<string, unknown> = { userId, isActive: true };
  if (options.accountId && Types.ObjectId.isValid(options.accountId)) {
    accountQuery._id = new Types.ObjectId(options.accountId);
  }

  const activeAccounts = (await AccountModel.find(accountQuery)
    .select('_id emailAddress displayName color')
    .lean()) as unknown as Array<Pick<IAccountDocument, '_id' | 'emailAddress' | 'displayName' | 'color'>>;

  if (activeAccounts.length === 0) {
    return { data: [], page, limit, total: 0 };
  }

  const accountIds = activeAccounts.map((a) => a._id);
  const accountsMap = new Map<string, { color?: string; email: string; name?: string }>();
  for (const acc of activeAccounts) {
    accountsMap.set(String(acc._id), {
      color: acc.color,
      email: acc.emailAddress,
      name: acc.displayName || acc.emailAddress,
    });
  }

  // 2. Résolution des dossiers à exclure (Trash / Junk par défaut)
  const mongoQuery: Record<string, unknown> = {
    accountId: { $in: accountIds },
  };

  if (options.folder) {
    mongoQuery.folder = options.folder;
  } else {
    const excludeTrash = !options.includeTrash;
    const excludeJunk = !options.includeJunk;

    if (excludeTrash || excludeJunk) {
      const cachedFolders = await FolderModel.find({ accountId: { $in: accountIds } })
        .select('path name specialUse')
        .lean();

      const excludedPaths = new Set<string>();
      for (const f of cachedFolders) {
        const normName = f.name.toLowerCase().trim();
        const isTrash =
          f.specialUse === '\\Trash' || TRASH_FALLBACKS.some((fb) => normName === fb || normName.includes(fb));
        const isJunk =
          f.specialUse === '\\Junk' || JUNK_FALLBACKS.some((fb) => normName === fb || normName.includes(fb));

        if (excludeTrash && isTrash) excludedPaths.add(f.path);
        if (excludeJunk && isJunk) excludedPaths.add(f.path);
      }

      if (excludedPaths.size > 0) {
        mongoQuery.folder = { $nin: Array.from(excludedPaths) };
      }
    }
  }

  // 3. Fusion des opérateurs de recherche q avec les filtres explicites
  const parsed = parseSearchQuery(options.q);
  const filters = { ...parsed.filters };
  if (options.from) filters.from = options.from;
  if (options.to) filters.to = options.to;
  if (options.subject) filters.subject = options.subject;
  if (options.seen !== undefined) filters.seen = options.seen;
  if (options.flagged !== undefined) filters.flagged = options.flagged;
  if (options.isPinned !== undefined) filters.isPinned = options.isPinned;
  if (options.tag) filters.tag = options.tag;
  if (options.hasAttachments !== undefined) filters.hasAttachments = options.hasAttachments;
  if (options.since) filters.since = options.since;
  if (options.before) filters.before = options.before;
  if (options.minSize !== undefined) filters.minSize = options.minSize;
  if (options.maxSize !== undefined) filters.maxSize = options.maxSize;

  // Recherche plein texte si un textQuery est présent
  if (parsed.textQuery) {
    mongoQuery.$text = { $search: parsed.textQuery };
  }

  // Filtres regex sécurisés
  if (filters.from) {
    mongoQuery['from.address'] = { $regex: escapeRegExp(filters.from), $options: 'i' };
  }
  if (filters.to) {
    mongoQuery['to.address'] = { $regex: escapeRegExp(filters.to), $options: 'i' };
  }
  if (filters.subject) {
    mongoQuery.subject = { $regex: escapeRegExp(filters.subject), $options: 'i' };
  }

  // Filtres booléens & exacts
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

  // Filtre par plage de dates
  if (filters.since || filters.before) {
    const dateFilter: Record<string, Date> = {};
    if (filters.since) dateFilter.$gte = filters.since;
    if (filters.before) dateFilter.$lte = filters.before;
    mongoQuery.date = dateFilter;
  }

  // Filtre par taille
  if (filters.minSize !== undefined || filters.maxSize !== undefined) {
    const sizeFilter: Record<string, number> = {};
    if (filters.minSize !== undefined) sizeFilter.$gte = filters.minSize;
    if (filters.maxSize !== undefined) sizeFilter.$lte = filters.maxSize;
    mongoQuery.size = sizeFilter;
  }

  // 4. Tri et pagination
  const sort = parsed.textQuery ? { score: { $meta: 'textScore' as const } } : { isPinned: -1, date: -1 };

  const [rawMessages, total] = await Promise.all([
    MessageModel.find(mongoQuery).sort(sort as never).skip(skip).limit(limit).lean(),
    MessageModel.countDocuments(mongoQuery),
  ]);

  // 5. Enrichissement des messages avec les attributs de compte (couleur, adresse)
  const enrichedMessages: UnifiedSearchMessageItem[] = rawMessages.map((msg) => {
    const accInfo = accountsMap.get(String(msg.accountId));
    return {
      ...(msg as unknown as UnifiedSearchMessageItem),
      accountColor: accInfo?.color,
      accountEmail: accInfo?.email,
      accountName: accInfo?.name,
    };
  });

  return {
    data: enrichedMessages,
    page,
    limit,
    total,
  };
}
