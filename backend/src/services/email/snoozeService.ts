import type { IAccountDocument } from '../../models/Account.js';
import { MessageModel, type IMessageDocument } from '../../models/Message.js';
import { AppError } from '../../utils/AppError.js';
import { publishEvent } from '../realtime/eventPublisher.js';
import { logger } from '../../config/logger.js';

/**
 * Met en sommeil un message jusqu'à une date future donnée,
 * ou le réveille immédiatement si snoozedUntilDate est null ("unsnooze").
 */
export async function snoozeMessage(
  account: IAccountDocument,
  folder: string,
  uid: number,
  snoozedUntilDate: Date | null,
): Promise<IMessageDocument> {
  const message = await MessageModel.findOne({
    accountId: account._id,
    folder,
    uid,
  });

  if (!message) {
    throw AppError.notFound('Message introuvable');
  }

  message.snoozedUntil = snoozedUntilDate;
  await message.save();

  // Notification temps réel SSE pour mettre à jour l'interface instantanément
  await publishEvent({
    type: 'message:flags',
    accountId: String(account._id),
    userId: String(account.userId),
    payload: {
      uid,
      folder,
      snoozedUntil: snoozedUntilDate ? snoozedUntilDate.toISOString() : null,
    },
  });

  return message;
}

/**
 * Détecte et réveille tous les messages dont la date de mise en sommeil est échue.
 * Appelé périodiquement par le worker de synchronisation.
 */
export async function checkExpiredSnoozes(): Promise<number> {
  const now = new Date();
  const expiredMessages = await MessageModel.find({
    snoozedUntil: { $lte: now, $ne: null },
  }).populate<{ accountId: IAccountDocument }>('accountId');

  if (expiredMessages.length === 0) {
    return 0;
  }

  logger.info({ count: expiredMessages.length }, 'Réveil des messages mis en sommeil expirés');

  let wakeCount = 0;
  for (const message of expiredMessages) {
    message.snoozedUntil = null;
    await message.save();
    wakeCount++;

    if (message.accountId && message.accountId.userId) {
      await publishEvent({
        type: 'message:new',
        accountId: String(message.accountId._id),
        userId: String(message.accountId.userId),
        payload: {
          uid: message.uid,
          folder: message.folder,
          snoozeWoken: true,
        },
      });
    }
  }

  return wakeCount;
}
