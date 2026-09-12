import mongoose from 'mongoose';
import {
  FollowUpReminderModel,
  type IFollowUpReminderDocument,
  type FollowUpReminderStatus,
} from '../../models/FollowUpReminder.js';
import { MessageModel } from '../../models/Message.js';
import { normalizeSubject } from './threadService.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../config/logger.js';

export interface CreateReminderInput {
  remindAt: string | Date;
  note?: string;
}

export interface PaginatedReminders {
  items: IFollowUpReminderDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Crée ou réarme un rappel de relance (Follow-Up Reminder) pour un message donné.
 */
export async function createOrUpdateReminder(
  userId: string,
  accountId: string,
  folder: string,
  uid: number,
  input: CreateReminderInput,
): Promise<IFollowUpReminderDocument> {
  const message = await MessageModel.findOne({ accountId, folder, uid });
  if (!message) {
    throw AppError.notFound('Message introuvable');
  }

  const remindDate = new Date(input.remindAt);
  if (isNaN(remindDate.getTime()) || remindDate.getTime() <= Date.now()) {
    throw AppError.badRequest("L'échéance du rappel doit être une date valide située dans le futur");
  }

  // Annule tout rappel précédent non résolu sur ce même message
  await FollowUpReminderModel.updateMany(
    {
      accountId: new mongoose.Types.ObjectId(accountId),
      folder,
      uid,
      status: { $in: ['pending', 'triggered'] },
    },
    { $set: { status: 'cancelled' } },
  );

  const targetRecipient = message.to[0]?.address || message.from?.address || '';
  const threadSubject = normalizeSubject(message.subject);

  const reminder = await FollowUpReminderModel.create({
    userId: new mongoose.Types.ObjectId(userId),
    accountId: new mongoose.Types.ObjectId(accountId),
    messageId: message.messageId,
    folder,
    uid,
    threadSubject,
    targetRecipient,
    remindAt: remindDate,
    note: input.note?.trim(),
    status: 'pending',
  });

  // Dénormalisation légère et atomique sur le message pour filtres et tri ultra-rapides
  await MessageModel.updateOne(
    { accountId, folder, uid },
    {
      $set: {
        followUpStatus: 'pending',
        followUpRemindAt: remindDate,
      },
    },
  );

  logger.info(
    { reminderId: reminder._id, accountId, folder, uid, remindAt: reminder.remindAt },
    'Rappel de suivi créé avec succès',
  );

  return reminder;
}

/**
 * Crée un rappel pour un email qui vient d'être expédié via SMTP.
 */
export async function createReminderForSentMessage(
  userId: string,
  accountId: string,
  messageId: string | undefined,
  subject: string,
  toAddress: string,
  folder: string,
  uid: number,
  input: CreateReminderInput,
): Promise<IFollowUpReminderDocument> {
  const remindDate = new Date(input.remindAt);
  if (isNaN(remindDate.getTime()) || remindDate.getTime() <= Date.now()) {
    throw AppError.badRequest("L'échéance du rappel doit être située dans le futur");
  }

  const threadSubject = normalizeSubject(subject);

  const reminder = await FollowUpReminderModel.create({
    userId: new mongoose.Types.ObjectId(userId),
    accountId: new mongoose.Types.ObjectId(accountId),
    messageId,
    folder,
    uid,
    threadSubject,
    targetRecipient: toAddress.toLowerCase().trim(),
    remindAt: remindDate,
    note: input.note?.trim(),
    status: 'pending',
  });

  // Met à jour le message si déjà présent dans MongoDB
  if (uid) {
    await MessageModel.updateOne(
      { accountId, folder, uid },
      {
        $set: {
          followUpStatus: 'pending',
          followUpRemindAt: remindDate,
        },
      },
    );
  }

  logger.info(
    { reminderId: reminder._id, accountId, messageId, remindAt: reminder.remindAt },
    'Rappel de suivi créé pour email envoyé',
  );

  return reminder;
}

/**
 * Récupère le rappel actif ou le plus récent associé à un message.
 */
export async function getReminderForMessage(
  accountId: string,
  folder: string,
  uid: number,
): Promise<IFollowUpReminderDocument | null> {
  return FollowUpReminderModel.findOne({
    accountId: new mongoose.Types.ObjectId(accountId),
    folder,
    uid,
  })
    .sort({ createdAt: -1 })
    .exec();
}

/**
 * Liste paginée des rappels d'un compte utilisateur, filtrable par statut.
 */
export async function listReminders(
  userId: string,
  accountId: string,
  status?: FollowUpReminderStatus,
  page = 1,
  limit = 50,
): Promise<PaginatedReminders> {
  const filter: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
    accountId: new mongoose.Types.ObjectId(accountId),
  };

  if (status) {
    filter.status = status;
  }

  const total = await FollowUpReminderModel.countDocuments(filter);
  const totalPages = Math.ceil(total / limit) || 1;
  const skip = (page - 1) * limit;

  const items = await FollowUpReminderModel.find(filter)
    .sort({ remindAt: 1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .exec();

  return {
    items,
    total,
    page,
    limit,
    totalPages,
  };
}

/**
 * Repousse l'échéance d'un rappel (Snooze).
 */
export async function snoozeReminder(
  userId: string,
  accountId: string,
  reminderId: string,
  newRemindAt: string | Date,
): Promise<IFollowUpReminderDocument> {
  const remindDate = new Date(newRemindAt);
  if (isNaN(remindDate.getTime()) || remindDate.getTime() <= Date.now()) {
    throw AppError.badRequest("La nouvelle date d'échéance doit être située dans le futur");
  }

  const reminder = await FollowUpReminderModel.findOne({
    _id: new mongoose.Types.ObjectId(reminderId),
    userId: new mongoose.Types.ObjectId(userId),
    accountId: new mongoose.Types.ObjectId(accountId),
  });

  if (!reminder) {
    throw AppError.notFound('Rappel introuvable');
  }

  reminder.remindAt = remindDate;
  reminder.status = 'pending';
  reminder.triggeredAt = undefined;
  await reminder.save();

  await MessageModel.updateOne(
    { accountId, folder: reminder.folder, uid: reminder.uid },
    { $set: { followUpStatus: 'pending', followUpRemindAt: remindDate } },
  );
  logger.info({ reminderId, newRemindAt: remindDate }, 'Rappel reporté (snooze)');
  return reminder;
}

/**
 * Acquitte un rappel échu (traité par l'utilisateur).
 */
export async function dismissReminder(
  userId: string,
  accountId: string,
  reminderId: string,
): Promise<IFollowUpReminderDocument> {
  const reminder = await FollowUpReminderModel.findOne({
    _id: new mongoose.Types.ObjectId(reminderId),
    userId: new mongoose.Types.ObjectId(userId),
    accountId: new mongoose.Types.ObjectId(accountId),
  });
  if (!reminder) throw AppError.notFound('Rappel introuvable');

  reminder.status = 'dismissed';
  reminder.dismissedAt = new Date();
  await reminder.save();

  await MessageModel.updateOne(
    { accountId, folder: reminder.folder, uid: reminder.uid },
    { $set: { followUpStatus: 'dismissed' } },
  );
  logger.info({ reminderId }, 'Rappel acquitté (dismissed)');
  return reminder;
}

/**
 * Annule un rappel (ne sera plus déclenché).
 */
export async function cancelReminder(
  userId: string,
  accountId: string,
  reminderId: string,
): Promise<IFollowUpReminderDocument> {
  const reminder = await FollowUpReminderModel.findOne({
    _id: new mongoose.Types.ObjectId(reminderId),
    userId: new mongoose.Types.ObjectId(userId),
    accountId: new mongoose.Types.ObjectId(accountId),
  });
  if (!reminder) throw AppError.notFound('Rappel introuvable');

  reminder.status = 'cancelled';
  await reminder.save();

  await MessageModel.updateOne(
    { accountId, folder: reminder.folder, uid: reminder.uid },
    { $set: { followUpStatus: null, followUpRemindAt: null } },
  );
  logger.info({ reminderId }, 'Rappel annulé');
  return reminder;
}
