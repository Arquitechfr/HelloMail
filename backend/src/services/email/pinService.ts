import type { IAccountDocument } from '../../models/Account.js';
import { MessageModel, IMessageDocument } from '../../models/Message.js';
import { AppError } from '../../utils/AppError.js';
import { publishEvent } from '../realtime/eventPublisher.js';
import { VIRTUAL_SNOOZED_FOLDER } from './folderService.js';

/**
 * Met en avant (épingle) ou retire la mise en avant d'un message.
 */
export async function pinMessage(
  account: IAccountDocument,
  folder: string,
  uid: number,
  isPinned: boolean,
): Promise<IMessageDocument> {
  const message = await MessageModel.findOneAndUpdate(
    {
      accountId: account._id,
      uid,
      ...(folder === VIRTUAL_SNOOZED_FOLDER ? { snoozedUntil: { $gt: new Date() } } : { folder }),
    },
    {
      $set: {
        isPinned,
        pinnedAt: isPinned ? new Date() : null,
      },
    },
    { new: true },
  );

  if (!message) {
    throw AppError.notFound('Message introuvable');
  }

  // Émission d'un événement temps réel SSE
  await publishEvent({
    type: 'message:flags',
    accountId: String(account._id),
    userId: String(account.userId),
    payload: {
      folder,
      uid,
      isPinned,
    },
  });

  return message;
}
