import { ScheduledMessageModel } from '../../models/ScheduledMessage.js';
import { AccountModel } from '../../models/Account.js';
import { sendEmail, type SendEmailInput } from '../email/sendService.js';
import { publishEvent } from '../realtime/eventPublisher.js';
import { logger } from '../../config/logger.js';

/**
 * Traite les emails programmés arrivés à échéance.
 * Verrouille chaque message de manière atomique pour éviter les envois concurrents.
 */
export async function processDueScheduledEmails(): Promise<number> {
  const now = new Date();
  let processedCount = 0;

  // Récupère les IDs des messages en attente arrivés à échéance
  const dueItems = await ScheduledMessageModel.find(
    { status: 'pending', scheduledAt: { $lte: now } },
    { _id: 1 },
  )
    .limit(10)
    .lean()
    .exec();

  for (const item of dueItems) {
    // Verrouillage atomique : passage à 'processing'
    const locked = await ScheduledMessageModel.findOneAndUpdate(
      { _id: item._id, status: 'pending' },
      { $set: { status: 'processing' }, $inc: { attempts: 1 } },
      { new: true },
    );

    if (!locked) continue; // Déjà pris en charge par un autre worker

    try {
      const account = await AccountModel.findById(locked.accountId);
      if (!account || !account.isActive) {
        locked.status = 'failed';
        locked.errorMessage = !account ? 'Compte introuvable' : 'Compte inactif';
        await locked.save();
        continue;
      }

      // Envoi du message via sendEmail
      await sendEmail(account, locked.payload as unknown as SendEmailInput);

      locked.status = 'sent';
      locked.sentAt = new Date();
      locked.errorMessage = undefined;
      await locked.save();
      processedCount++;

      logger.info(
        { scheduledId: locked._id, accountId: locked.accountId, subject: locked.payload.subject },
        'Email programmé envoyé avec succès',
      );

      // Notification temps réel SSE
      try {
        await publishEvent({
          type: 'scheduled:sent',
          userId: String(locked.userId),
          accountId: String(locked.accountId),
          payload: { scheduledId: String(locked._id) },
        });
      } catch {
        // Non bloquant
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
      logger.error(
        { scheduledId: locked._id, accountId: locked.accountId, error: errorMsg, attempts: locked.attempts },
        'Échec envoi email programmé',
      );

      if (locked.attempts >= 3) {
        locked.status = 'failed';
        locked.errorMessage = errorMsg;
      } else {
        // Reste en attente pour un prochain essai
        locked.status = 'pending';
        locked.errorMessage = `Échec tentative ${locked.attempts} : ${errorMsg}`;
      }
      await locked.save();
    }
  }

  return processedCount;
}

/**
 * Démarre le runner d'emails programmés dans le worker.
 */
export function startScheduledEmailRunner(intervalMs = 15000): { stop: () => void } {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await processDueScheduledEmails();
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : 'erreur inconnue' },
        'Erreur dans la boucle scheduledEmailRunner',
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
