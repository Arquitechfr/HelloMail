import { AccountModel } from '../../models/Account.js';
import { MessageModel, IMessageDocument } from '../../models/Message.js';
import { FolderModel } from '../../models/Folder.js';

export type UnifiedFolderType =
  | 'inbox'
  | 'starred'
  | 'pinned'
  | 'drafts'
  | 'sent'
  | 'snoozed'
  | 'archive'
  | 'junk'
  | 'trash';

export interface UnifiedMessagesOptions {
  type: UnifiedFolderType;
  page?: number;
  limit?: number;
  tag?: string;
}

export interface UnifiedMessagesResult {
  data: IMessageDocument[];
  page: number;
  limit: number;
  total: number;
}

export type UnifiedStatusResult = Record<
  UnifiedFolderType,
  { unseen: number; total: number }
>;

const FALLBACK_NAMES: Record<string, string[]> = {
  '\\Sent': ['sent', 'sent items', 'sent mail', 'envoyés', 'envoye', 'outbox'],
  '\\Trash': ['trash', 'corbeille', 'deleted', 'deleted items', 'bin'],
  '\\Drafts': ['drafts', 'brouillons', 'brouillon'],
  '\\Junk': ['junk', 'spam', 'junk mail', 'junk email', 'courrier indésirable', 'indésirables'],
  '\\Archive': ['archive', 'archives', 'archivés'],
};

const SPECIAL_USE_BY_TYPE: Partial<Record<UnifiedFolderType, string>> = {
  sent: '\\Sent',
  trash: '\\Trash',
  drafts: '\\Drafts',
  junk: '\\Junk',
  archive: '\\Archive',
};

/**
 * Résout le nom du dossier pour un compte donné depuis le cache FolderModel.
 */
function resolveAccountFolderPath(
  accountIdStr: string,
  specialUseTag: string,
  foldersByAccount: Map<string, Array<{ path: string; specialUse?: string; name: string }>>,
): string {
  const folders = foldersByAccount.get(accountIdStr) || [];
  // 1. Cherche par specialUse
  const matchSpecial = folders.find((f) => f.specialUse === specialUseTag);
  if (matchSpecial) return matchSpecial.path;

  // 2. Cherche par nom de fallback
  const fallbacks = FALLBACK_NAMES[specialUseTag] || [];
  const matchFallback = folders.find((f) => {
    const norm = f.name.toLowerCase().trim();
    return fallbacks.some((fb) => norm === fb || norm.includes(fb));
  });
  if (matchFallback) return matchFallback.path;

  // 3. Fallback standard
  return specialUseTag.replace(/^\\/, '');
}

export async function getUnifiedMessages(
  userId: string,
  options: UnifiedMessagesOptions,
): Promise<UnifiedMessagesResult> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));
  const skip = (page - 1) * limit;

  const activeAccounts = await AccountModel.find({ userId, isActive: true }).select('_id').lean();
  if (activeAccounts.length === 0) {
    return { data: [], page, limit, total: 0 };
  }

  const accountIds = activeAccounts.map((a) => a._id);
  const now = new Date();

  // Chargement des dossiers pour résoudre les dossiers spéciaux
  const cachedFolders = await FolderModel.find({ accountId: { $in: accountIds } })
    .select('accountId path name specialUse')
    .lean();

  const foldersByAccount = new Map<string, Array<{ path: string; specialUse?: string; name: string }>>();
  for (const f of cachedFolders) {
    const accId = f.accountId.toString();
    if (!foldersByAccount.has(accId)) foldersByAccount.set(accId, []);
    foldersByAccount.get(accId)!.push(f);
  }

  const filter: Record<string, unknown> = {};

  if (options.type === 'inbox') {
    filter.accountId = { $in: accountIds };
    filter.folder = 'INBOX';
    filter.snoozedUntil = { $not: { $gt: now } };
  } else if (options.type === 'starred') {
    filter.accountId = { $in: accountIds };
    filter['flags.flagged'] = true;
    filter.snoozedUntil = { $not: { $gt: now } };
  } else if (options.type === 'pinned') {
    filter.accountId = { $in: accountIds };
    filter.isPinned = true;
    filter.snoozedUntil = { $not: { $gt: now } };
  } else if (options.type === 'snoozed') {
    filter.accountId = { $in: accountIds };
    filter.snoozedUntil = { $gt: now };
  } else {
    // sent, drafts, trash, junk, archive
    const specialTag = SPECIAL_USE_BY_TYPE[options.type];
    if (specialTag) {
      const orConditions = accountIds.map((accId) => ({
        accountId: accId,
        folder: resolveAccountFolderPath(accId.toString(), specialTag, foldersByAccount),
      }));
      filter.$or = orConditions;
      if (options.type !== 'trash' && options.type !== 'junk') {
        filter.snoozedUntil = { $not: { $gt: now } };
      }
    }
  }

  if (options.tag) {
    filter.tags = options.tag;
  }

  const sortOption: Record<string, 1 | -1> =
    options.type === 'snoozed'
      ? { isPinned: -1, snoozedUntil: 1 }
      : { isPinned: -1, date: -1 };

  const [messages, total] = await Promise.all([
    MessageModel.find(filter).sort(sortOption).skip(skip).limit(limit).lean(),
    MessageModel.countDocuments(filter),
  ]);

  return {
    data: messages as unknown as IMessageDocument[],
    page,
    limit,
    total,
  };
}

export async function getUnifiedStatus(userId: string): Promise<UnifiedStatusResult> {
  const activeAccounts = await AccountModel.find({ userId, isActive: true }).select('_id').lean();
  const defaultResult: UnifiedStatusResult = {
    inbox: { unseen: 0, total: 0 },
    starred: { unseen: 0, total: 0 },
    pinned: { unseen: 0, total: 0 },
    drafts: { unseen: 0, total: 0 },
    sent: { unseen: 0, total: 0 },
    snoozed: { unseen: 0, total: 0 },
    archive: { unseen: 0, total: 0 },
    junk: { unseen: 0, total: 0 },
    trash: { unseen: 0, total: 0 },
  };

  if (activeAccounts.length === 0) {
    return defaultResult;
  }

  const accountIds = activeAccounts.map((a) => a._id);
  const now = new Date();

  // Chargement des dossiers en base
  const cachedFolders = await FolderModel.find({ accountId: { $in: accountIds } })
    .select('accountId path name specialUse unseen messages')
    .lean();

  const foldersByAccount = new Map<string, Array<{ path: string; specialUse?: string; name: string; unseen: number; messages: number }>>();
  for (const f of cachedFolders) {
    const accId = f.accountId.toString();
    if (!foldersByAccount.has(accId)) foldersByAccount.set(accId, []);
    foldersByAccount.get(accId)!.push(f);
  }

  // Calcul INBOX
  let inboxUnseen = 0;
  let inboxTotal = 0;
  for (const acc of activeAccounts) {
    const accFolders = foldersByAccount.get(acc._id.toString()) || [];
    const inbox = accFolders.find((f) => f.path === 'INBOX' || f.specialUse === '\\Inbox');
    if (inbox) {
      inboxUnseen += inbox.unseen || 0;
      inboxTotal += inbox.messages || 0;
    }
  }
  defaultResult.inbox = { unseen: inboxUnseen, total: inboxTotal };

  // Calcul Starred & Pinned & Snoozed via MessageModel
  const [starredUnseen, starredTotal, pinnedTotal, snoozedTotal] = await Promise.all([
    MessageModel.countDocuments({
      accountId: { $in: accountIds },
      'flags.flagged': true,
      'flags.seen': false,
      snoozedUntil: { $not: { $gt: now } },
    }),
    MessageModel.countDocuments({
      accountId: { $in: accountIds },
      'flags.flagged': true,
      snoozedUntil: { $not: { $gt: now } },
    }),
    MessageModel.countDocuments({
      accountId: { $in: accountIds },
      isPinned: true,
      snoozedUntil: { $not: { $gt: now } },
    }),
    MessageModel.countDocuments({
      accountId: { $in: accountIds },
      snoozedUntil: { $gt: now },
    }),
  ]);

  defaultResult.starred = { unseen: starredUnseen, total: starredTotal };
  defaultResult.pinned = { unseen: 0, total: pinnedTotal };
  defaultResult.snoozed = { unseen: 0, total: snoozedTotal };

  // Calcul des dossiers spéciaux restants (sent, drafts, archive, junk, trash)
  const types: UnifiedFolderType[] = ['sent', 'drafts', 'archive', 'junk', 'trash'];
  for (const t of types) {
    const tag = SPECIAL_USE_BY_TYPE[t];
    if (!tag) continue;
    let tUnseen = 0;
    let tTotal = 0;
    for (const acc of activeAccounts) {
      const path = resolveAccountFolderPath(acc._id.toString(), tag, foldersByAccount);
      const folder = (foldersByAccount.get(acc._id.toString()) || []).find((f) => f.path === path);
      if (folder) {
        tUnseen += folder.unseen || 0;
        tTotal += folder.messages || 0;
      }
    }
    defaultResult[t] = { unseen: tUnseen, total: tTotal };
  }

  return defaultResult;
}
