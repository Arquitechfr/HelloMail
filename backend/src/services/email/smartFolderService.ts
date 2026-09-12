import { Types } from 'mongoose';
import { SmartFolderModel, type SmartFolderDocument, type ISmartFolder } from '../../models/SmartFolder.js';
import { AccountModel } from '../../models/Account.js';
import { MessageModel, type IMessageDocument } from '../../models/Message.js';
import { parseSearchQuery } from './searchService.js';
import { AppError } from '../../utils/AppError.js';
import { escapeRegExp } from '../../utils/regex.js';
import {
  createSmartFolderSchema,
  type CreateSmartFolderInput,
  type UpdateSmartFolderInput,
} from '../../schemas/smartFolderSchemas.js';

export interface SmartFolderMessagesOptions {
  page?: number;
  limit?: number;
}

export interface SmartFolderMessagesResult {
  data: IMessageDocument[];
  page: number;
  limit: number;
  total: number;
  smartFolder: SmartFolderDocument;
}

export type SmartFolderCountsResult = Record<string, { total: number; unread: number }>;

const EXCLUDED_FOLDERS = [
  'Trash',
  'trash',
  'TRASH',
  'Corbeille',
  'corbeille',
  'Deleted Items',
  'Junk',
  'junk',
  'JUNK',
  'Spam',
  'spam',
  'SPAM',
  'Courrier indésirable',
];

/**
 * Construit la requête MongoDB à partir de la définition d'un dossier intelligent
 * et des comptes autorisés de l'utilisateur.
 */
export function buildSmartFolderMongoQuery(
  smartFolder: Pick<ISmartFolder, 'query' | 'accountId'>,
  userAccountIds: string[],
): Record<string, unknown> {
  const allowedAccountIds = userAccountIds.map((id) => String(id));

  // Restriction sur un compte spécifique ou sur tous les comptes de l'utilisateur
  let targetAccountIds: string[] = [];
  if (smartFolder.accountId) {
    const specifiedAccountId = String(smartFolder.accountId);
    if (allowedAccountIds.includes(specifiedAccountId)) {
      targetAccountIds = [specifiedAccountId];
    } else {
      // Le compte ciblé n'appartient pas à l'utilisateur
      targetAccountIds = [];
    }
  } else {
    targetAccountIds = allowedAccountIds;
  }

  if (targetAccountIds.length === 0) {
    // Force un résultat vide
    return { _id: { $exists: false } };
  }

  const mongoQuery: Record<string, unknown> = {
    accountId: targetAccountIds.length === 1 ? targetAccountIds[0] : { $in: targetAccountIds },
    folder: { $nin: EXCLUDED_FOLDERS },
  };

  const parsed = parseSearchQuery(smartFolder.query);

  if (parsed.textQuery) {
    mongoQuery.$text = { $search: parsed.textQuery };
  }

  const { filters } = parsed;

  if (filters.from) {
    mongoQuery['from.address'] = { $regex: escapeRegExp(filters.from), $options: 'i' };
  }
  if (filters.to) {
    mongoQuery['to.address'] = { $regex: escapeRegExp(filters.to), $options: 'i' };
  }
  if (filters.subject) {
    mongoQuery.subject = { $regex: escapeRegExp(filters.subject), $options: 'i' };
  }
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
  if (filters.since || filters.before) {
    const dateFilter: Record<string, Date> = {};
    if (filters.since) dateFilter.$gte = filters.since;
    if (filters.before) dateFilter.$lte = filters.before;
    mongoQuery.date = dateFilter;
  }

  return mongoQuery;
}

/**
 * Récupère les IDs de comptes appartenant à l'utilisateur.
 */
async function getUserAccountIds(userId: string): Promise<string[]> {
  const accounts = await AccountModel.find({ userId: new Types.ObjectId(userId) }).select('_id').lean();
  return accounts.map((acc) => String(acc._id));
}

/**
 * Liste les dossiers intelligents d'un utilisateur.
 */
export async function listSmartFolders(userId: string): Promise<SmartFolderDocument[]> {
  return SmartFolderModel.find({ userId: new Types.ObjectId(userId) })
    .sort({ order: 1, createdAt: 1 });
}

/**
 * Crée un nouveau dossier intelligent.
 */
export async function createSmartFolder(
  userId: string,
  input: CreateSmartFolderInput,
): Promise<SmartFolderDocument> {
  const parsed = createSmartFolderSchema.parse(input);
  const userObjId = new Types.ObjectId(userId);

  if (parsed.accountId) {
    const exists = await AccountModel.findOne({
      _id: new Types.ObjectId(parsed.accountId),
      userId: userObjId,
    }).lean();
    if (!exists) {
      throw AppError.notFound('Compte de messagerie introuvable');
    }
  }

  let order = parsed.order;
  if (order === undefined) {
    const last = await SmartFolderModel.findOne({ userId: userObjId }).sort({ order: -1 }).lean();
    order = last ? last.order + 1 : 0;
  }

  const smartFolder = new SmartFolderModel({
    ...parsed,
    userId: userObjId,
    accountId: parsed.accountId ? new Types.ObjectId(parsed.accountId) : undefined,
    order,
  });

  return smartFolder.save();
}

/**
 * Met à jour un dossier intelligent.
 */
export async function updateSmartFolder(
  userId: string,
  folderId: string,
  input: UpdateSmartFolderInput,
): Promise<SmartFolderDocument> {
  const userObjId = new Types.ObjectId(userId);
  const smartFolder = await SmartFolderModel.findOne({
    _id: new Types.ObjectId(folderId),
    userId: userObjId,
  });

  if (!smartFolder) {
    throw AppError.notFound('Dossier intelligent introuvable');
  }

  if (input.accountId !== undefined) {
    if (input.accountId) {
      const exists = await AccountModel.findOne({
        _id: new Types.ObjectId(input.accountId),
        userId: userObjId,
      }).lean();
      if (!exists) {
        throw AppError.notFound('Compte de messagerie introuvable');
      }
      smartFolder.accountId = new Types.ObjectId(input.accountId);
    } else {
      smartFolder.accountId = undefined;
    }
  }

  if (input.name !== undefined) smartFolder.name = input.name;
  if (input.icon !== undefined) smartFolder.icon = input.icon;
  if (input.color !== undefined) smartFolder.color = input.color;
  if (input.query !== undefined) smartFolder.query = input.query;
  if (input.order !== undefined) smartFolder.order = input.order;

  return smartFolder.save();
}

/**
 * Supprime un dossier intelligent.
 */
export async function deleteSmartFolder(userId: string, folderId: string): Promise<void> {
  const result = await SmartFolderModel.deleteOne({
    _id: new Types.ObjectId(folderId),
    userId: new Types.ObjectId(userId),
  });

  if (result.deletedCount === 0) {
    throw AppError.notFound('Dossier intelligent introuvable');
  }
}

/**
 * Réordonne les dossiers intelligents d'un utilisateur.
 */
export async function reorderSmartFolders(userId: string, ids: string[]): Promise<void> {
  const userObjId = new Types.ObjectId(userId);
  const operations = ids.map((id, index) => ({
    updateOne: {
      filter: { _id: new Types.ObjectId(id), userId: userObjId },
      update: { $set: { order: index } },
    },
  }));

  if (operations.length > 0) {
    await SmartFolderModel.bulkWrite(operations);
  }
}

/**
 * Résout les messages correspondant à un dossier intelligent.
 */
export async function resolveSmartFolderMessages(
  userId: string,
  folderId: string,
  options: SmartFolderMessagesOptions = {},
): Promise<SmartFolderMessagesResult> {
  const userObjId = new Types.ObjectId(userId);
  const smartFolder = await SmartFolderModel.findOne({
    _id: new Types.ObjectId(folderId),
    userId: userObjId,
  });

  if (!smartFolder) {
    throw AppError.notFound('Dossier intelligent introuvable');
  }

  const userAccountIds = await getUserAccountIds(userId);
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));
  const skip = (page - 1) * limit;

  const mongoQuery = buildSmartFolderMongoQuery(smartFolder, userAccountIds);

  const [data, total] = await Promise.all([
    MessageModel.find(mongoQuery)
      .sort({ isPinned: -1, date: -1 })
      .skip(skip)
      .limit(limit),
    MessageModel.countDocuments(mongoQuery),
  ]);

  return {
    data,
    page,
    limit,
    total,
    smartFolder,
  };
}

/**
 * Calcule les compteurs (total et non-lus) pour tous les dossiers intelligents de l'utilisateur.
 */
export async function getSmartFolderCounts(userId: string): Promise<SmartFolderCountsResult> {
  const userObjId = new Types.ObjectId(userId);
  const [smartFolders, userAccountIds] = await Promise.all([
    SmartFolderModel.find({ userId: userObjId }).lean(),
    getUserAccountIds(userId),
  ]);

  const result: SmartFolderCountsResult = {};

  await Promise.all(
    smartFolders.map(async (folder) => {
      const folderIdStr = String(folder._id);
      const query = buildSmartFolderMongoQuery(folder, userAccountIds);

      const [total, unread] = await Promise.all([
        MessageModel.countDocuments(query),
        MessageModel.countDocuments({ ...query, 'flags.seen': false }),
      ]);

      result[folderIdStr] = { total, unread };
    }),
  );

  return result;
}
