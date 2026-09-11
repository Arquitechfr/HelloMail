import mongoose from 'mongoose';
import { ScheduledMessageModel, type IScheduledMessageDocument } from '../../models/ScheduledMessage.js';
import { AccountModel } from '../../models/Account.js';
import { AppError } from '../../utils/AppError.js';
import type { ScheduleEmailInput } from '../../schemas/scheduledMessageSchemas.js';

/**
 * Programme l'envoi d'un email à une date/heure ultérieure.
 */
export async function scheduleEmail(
  userId: string,
  accountId: string,
  input: ScheduleEmailInput,
): Promise<IScheduledMessageDocument> {
  const account = await AccountModel.findOne({ _id: accountId, userId });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const { scheduledAt, ...payload } = input;

  const scheduled = await ScheduledMessageModel.create({
    userId: new mongoose.Types.ObjectId(userId),
    accountId: new mongoose.Types.ObjectId(accountId),
    payload,
    scheduledAt,
    status: 'pending',
    attempts: 0,
  });

  return scheduled;
}

/**
 * Liste les emails programmés en attente d'un utilisateur.
 */
export async function listScheduledEmails(
  userId: string,
  accountId?: string,
): Promise<IScheduledMessageDocument[]> {
  const filter: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
    status: 'pending',
  };

  if (accountId) {
    filter.accountId = new mongoose.Types.ObjectId(accountId);
  }

  return ScheduledMessageModel.find(filter).sort({ scheduledAt: 1 }).exec();
}

/**
 * Récupère un email programmé spécifique.
 */
export async function getScheduledEmail(
  userId: string,
  scheduledId: string,
): Promise<IScheduledMessageDocument> {
  const scheduled = await ScheduledMessageModel.findOne({
    _id: scheduledId,
    userId,
  }).exec();

  if (!scheduled) {
    throw AppError.notFound('Message programmé introuvable');
  }

  return scheduled;
}

/**
 * Annule un email programmé s'il est encore en attente.
 */
export async function cancelScheduledEmail(
  userId: string,
  scheduledId: string,
): Promise<void> {
  const scheduled = await ScheduledMessageModel.findOne({
    _id: scheduledId,
    userId,
  });

  if (!scheduled) {
    throw AppError.notFound('Message programmé introuvable');
  }

  if (scheduled.status !== 'pending') {
    throw AppError.badRequest(
      scheduled.status === 'sent'
        ? 'Ce message a déjà été envoyé'
        : 'Ce message ne peut plus être annulé',
    );
  }

  await ScheduledMessageModel.deleteOne({ _id: scheduledId });
}
