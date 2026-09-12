import { FollowUpReminderModel } from '../../models/FollowUpReminder.js';
import { MessageModel } from '../../models/Message.js';
import { publishEvent } from '../realtime/eventPublisher.js';
import { logger } from '../../config/logger.js';

/**
 * Traite les rappels de relance arrivés à échéance.
 * Verrouille chaque rappel de manière atomique pour éviter les doubles déclenchements.
 */
export async function processDueFollowUpReminders(): Promise<number> {
  const now = new Date();
  let processedCount = 0;

  // Récupère les IDs des rappels en attente arrivés à échéance
  const dueItems = await FollowUpReminderModel.find(
    { status: 'pending', remindAt: { $lte: now } },
    { _id: 1 },
  )
    .limit(50)
    .lean()
    .exec();

  for (const item of dueItems) {
    // Verrouillage atomique : passage à 'triggered'
    const locked = await FollowUpReminderModel.findOneAndUpdate(
      { _id: item._id, status: 'pending' },
      { $set: { status: 'triggered', triggeredAt: now } },
      { returnDocument: 'after' },
    );

    if (!locked) continue; // Déjà pris en charge par une exécution concurrente

    try {
      // Synchronise MessageModel pour mise en valeur dans les listes
      await MessageModel.updateOne(
        { accountId: locked.accountId, folder: locked.folder, uid: locked.uid },
        { $set: { followUpStatus: 'triggered' } },
      );

      processedCount++;

      logger.info(
        {
          reminderId: locked._id,
          accountId: locked.accountId,
          folder: locked.folder,
          uid: locked.uid,
          subject: locked.threadSubject,
        },
        'Rappel de suivi déclenché à échéance (triggered)',
      );

      // Notification temps réel SSE
      try {
        await publishEvent({
          type: 'reminder:triggered',
          userId: String(locked.userId),
          accountId: String(locked.accountId),
          payload: {
            reminderId: String(locked._id),
            messageId: locked.messageId,
            folder: locked.folder,
            uid: locked.uid,
            subject: locked.threadSubject,
            targetRecipient: locked.targetRecipient,
            remindAt: locked.remindAt,
            note: locked.note,
          },
        });
      } catch {
        // Non bloquant
      }
    } catch (err) {
      logger.error(
        {
          reminderId: locked._id,
          error: err instanceof Error ? err.message : 'erreur inconnue',
        },
        'Erreur lors du traitement d\'un rappel de relance échu',
      );
    }
  }

  return processedCount;
}

/**
 * Démarre le runner périodique des rappels de relance dans le worker.
 */
export function startFollowUpReminderRunner(intervalMs = 30000): { stop: () => void } {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await processDueFollowUpReminders();
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : 'erreur inconnue' },
        'Erreur dans la boucle followUpReminderRunner',
      );
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, intervalMs);
  timer.unref();

  return {
    stop: () => {
      clearInterval(timer);
    },
  };
}
