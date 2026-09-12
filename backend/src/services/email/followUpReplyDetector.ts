import mongoose from 'mongoose';
import { FollowUpReminderModel } from '../../models/FollowUpReminder.js';
import { MessageModel, type IMessageDocument } from '../../models/Message.js';
import { normalizeSubject } from './threadService.js';
import { publishEvent } from '../realtime/eventPublisher.js';
import { logger } from '../../config/logger.js';

/**
 * Détecte si un message entrant constitue une réponse à un email sous rappel de suivi.
 * Si une réponse est confirmée, le rappel est automatiquement désactivé (statut 'replied').
 *
 * Critères d'association (par ordre de précision) :
 * 1. Correspondance exacte inReplyTo -> reminder.messageId
 * 2. Présence de reminder.messageId dans l'en-tête References
 * 3. Repli heuristique : sujet normalisé identique ET expéditeur égal au destinataire surveillé
 *
 * @returns true si un rappel a été résolu, false sinon.
 */
export async function checkAndResolveFollowUpReminder(
  accountId: string,
  incomingMessage: IMessageDocument,
): Promise<boolean> {
  // Ignore les messages sortants (dossiers Sent ou Drafts)
  const lowerFolder = incomingMessage.folder.toLowerCase();
  if (lowerFolder.includes('sent') || lowerFolder.includes('draft') || lowerFolder.includes('envoy')) {
    return false;
  }

  const accountObjId = new mongoose.Types.ObjectId(accountId);

  // Récupère tous les rappels actifs pour ce compte
  const activeReminders = await FollowUpReminderModel.find({
    accountId: accountObjId,
    status: { $in: ['pending', 'triggered'] },
  }).exec();

  if (activeReminders.length === 0) {
    return false;
  }

  const incomingInReplyTo = incomingMessage.inReplyTo?.trim().toLowerCase();
  const incomingSender = incomingMessage.from?.address?.trim().toLowerCase() ?? '';
  const incomingNormalizedSubject = normalizeSubject(incomingMessage.subject).toLowerCase();

  for (const reminder of activeReminders) {
    let matched = false;
    const targetMsgId = reminder.messageId?.trim().toLowerCase();

    // 1. Match inReplyTo
    if (incomingInReplyTo && targetMsgId && incomingInReplyTo === targetMsgId) {
      matched = true;
    }

    // 2. Match heuristique sujet normalisé + expéditeur
    if (!matched && incomingNormalizedSubject && reminder.threadSubject) {
      const reminderNormalizedSubject = reminder.threadSubject.toLowerCase();
      const targetRecipient = reminder.targetRecipient.toLowerCase();

      if (
        incomingNormalizedSubject === reminderNormalizedSubject &&
        incomingSender === targetRecipient
      ) {
        matched = true;
      }
    }

    if (matched) {
      reminder.status = 'replied';
      reminder.repliedAt = new Date();
      await reminder.save();

      // Synchronise MessageModel
      await MessageModel.updateOne(
        { accountId: reminder.accountId, folder: reminder.folder, uid: reminder.uid },
        { $set: { followUpStatus: 'replied' } },
      );

      logger.info(
        {
          reminderId: reminder._id,
          accountId,
          incomingUid: incomingMessage.uid,
          incomingFrom: incomingSender,
        },
        'Rappel de suivi résolu automatiquement par une réponse entrante',
      );

      // Notification temps réel SSE
      try {
        await publishEvent({
          type: 'reminder:resolved',
          accountId,
          userId: String(reminder.userId),
          payload: {
            reminderId: String(reminder._id),
            messageId: reminder.messageId,
            folder: reminder.folder,
            uid: reminder.uid,
            status: 'replied',
            repliedBy: incomingMessage.from,
          },
        });
      } catch {
        // Non bloquant
      }

      return true;
    }
  }

  return false;
}
