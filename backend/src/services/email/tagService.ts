import { Types } from 'mongoose';
import { TagModel, type ITagDocument } from '../../models/Tag.js';
import { MessageModel, type IMessageDocument } from '../../models/Message.js';
import { AccountModel } from '../../models/Account.js';
import { AppError } from '../../utils/AppError.js';
import type {
  CreateTagInput,
  UpdateTagInput,
  BatchSetMessageTagsInput,
} from '../../schemas/tagSchemas.js';

export async function listUserTags(userId: string): Promise<ITagDocument[]> {
  return TagModel.find({ userId: new Types.ObjectId(userId) }).sort({ order: 1, createdAt: 1 });
}

export async function createUserTag(
  userId: string,
  input: CreateTagInput,
): Promise<ITagDocument> {
  const existing = await TagModel.findOne({
    userId: new Types.ObjectId(userId),
    name: { $regex: new RegExp(`^${input.name.trim()}$`, 'i') },
  });
  if (existing) {
    throw AppError.conflict('Un libellé avec ce nom existe déjà');
  }

  let order = input.order;
  if (order === undefined) {
    const last = await TagModel.findOne({ userId: new Types.ObjectId(userId) }).sort({ order: -1 });
    order = last ? last.order + 1 : 0;
  }

  return TagModel.create({
    userId: new Types.ObjectId(userId),
    name: input.name.trim(),
    color: input.color || '#3b82f6',
    order,
  });
}

export async function updateUserTag(
  userId: string,
  tagId: string,
  input: UpdateTagInput,
): Promise<ITagDocument> {
  const tag = await TagModel.findOne({
    _id: new Types.ObjectId(tagId),
    userId: new Types.ObjectId(userId),
  });
  if (!tag) {
    throw AppError.notFound('Libellé introuvable');
  }

  if (input.name && input.name.trim().toLowerCase() !== tag.name.toLowerCase()) {
    const duplicate = await TagModel.findOne({
      userId: new Types.ObjectId(userId),
      name: { $regex: new RegExp(`^${input.name.trim()}$`, 'i') },
      _id: { $ne: tag._id },
    });
    if (duplicate) {
      throw AppError.conflict('Un autre libellé avec ce nom existe déjà');
    }

    const oldName = tag.name;
    const newName = input.name.trim();

    // Met à jour le nom du tag dans tous les messages de l'utilisateur
    const userAccounts = await AccountModel.find({ userId: new Types.ObjectId(userId) }).select('_id');
    const accountIds = userAccounts.map((a) => a._id);
    if (accountIds.length > 0) {
      await MessageModel.updateMany(
        { accountId: { $in: accountIds }, tags: oldName },
        { $set: { 'tags.$[elem]': newName } },
        { arrayFilters: [{ elem: oldName }] },
      );
    }
    tag.name = newName;
  }

  if (input.color !== undefined) tag.color = input.color;
  if (input.order !== undefined) tag.order = input.order;

  await tag.save();
  return tag;
}

export async function deleteUserTag(userId: string, tagId: string): Promise<void> {
  const tag = await TagModel.findOne({
    _id: new Types.ObjectId(tagId),
    userId: new Types.ObjectId(userId),
  });
  if (!tag) {
    throw AppError.notFound('Libellé introuvable');
  }

  // Retire ce tag de tous les messages de l'utilisateur
  const userAccounts = await AccountModel.find({ userId: new Types.ObjectId(userId) }).select('_id');
  const accountIds = userAccounts.map((a) => a._id);
  if (accountIds.length > 0) {
    await MessageModel.updateMany(
      { accountId: { $in: accountIds }, tags: tag.name },
      { $pull: { tags: tag.name } },
    );
  }

  await TagModel.deleteOne({ _id: tag._id });
}

export async function setMessageTags(
  userId: string,
  accountId: string,
  folder: string,
  uid: number,
  tags: string[],
): Promise<IMessageDocument> {
  const account = await AccountModel.findOne({
    _id: new Types.ObjectId(accountId),
    userId: new Types.ObjectId(userId),
  });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const message = await MessageModel.findOneAndUpdate(
    { accountId: account._id, folder, uid },
    { $set: { tags } },
    { returnDocument: 'after' },
  );
  if (!message) {
    throw AppError.notFound('Message introuvable');
  }

  return message;
}

export async function batchSetMessageTags(
  userId: string,
  accountId: string,
  input: BatchSetMessageTagsInput,
): Promise<{ modifiedCount: number }> {
  const account = await AccountModel.findOne({
    _id: new Types.ObjectId(accountId),
    userId: new Types.ObjectId(userId),
  });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const filter = {
    accountId: account._id,
    folder: input.folder,
    uid: { $in: input.uids },
  };

  let updateQuery: Record<string, unknown>;
  if (input.mode === 'add') {
    updateQuery = { $addToSet: { tags: { $each: input.tags } } };
  } else if (input.mode === 'remove') {
    updateQuery = { $pullAll: { tags: input.tags } };
  } else {
    updateQuery = { $set: { tags: input.tags } };
  }

  const result = await MessageModel.updateMany(filter, updateQuery);
  return { modifiedCount: result.modifiedCount };
}
