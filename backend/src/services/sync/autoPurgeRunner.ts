import { AccountModel } from '../../models/Account.js';
import { UserModel } from '../../models/User.js';
import { findTrashFolder, findJunkFolder } from '../email/specialFolders.js';
import { purgeOldMessages } from '../email/folderPurgeService.js';
import { logger } from '../../config/logger.js';

/**
 * Exécute un cycle de purge automatique sur l'ensemble des comptes actifs.
 * Élimine les messages de Corbeille et Spams dont l'ancienneté dépasse le seuil configuré.
 */
export async function runAutoPurgeCycle(): Promise<number> {
  let totalPurged = 0;

  try {
    const activeAccounts = await AccountModel.find({ isActive: true });

    for (const account of activeAccounts) {
      try {
        const user = await UserModel.findById(account.userId).select('preferences').lean();
        const trashDays = user?.preferences?.autoPurgeTrashDays ?? 30;
        const junkDays = user?.preferences?.autoPurgeJunkDays ?? 30;

        // 1. Purge de la Corbeille
        if (trashDays > 0) {
          const trashFolder = await findTrashFolder(account).catch(() => null);
          if (trashFolder) {
            const count = await purgeOldMessages(account, trashFolder, trashDays);
            totalPurged += count;
          }
        }

        // 2. Purge des Courriers indésirables (Junk/Spam)
        if (junkDays > 0) {
          const junkFolder = await findJunkFolder(account).catch(() => null);
          if (junkFolder) {
            const count = await purgeOldMessages(account, junkFolder, junkDays);
            totalPurged += count;
          }
        }
      } catch (accountError) {
        logger.warn(
          {
            accountId: account._id,
            error: accountError instanceof Error ? accountError.message : 'inconnu',
          },
          'Échec auto-purge pour le compte (non bloquant)',
        );
      }
    }
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : 'inconnu' },
      'Erreur lors du cycle global d\'auto-purge',
    );
  }

  return totalPurged;
}

/**
 * Démarre le runner d'auto-purge périodique dans le sync worker.
 */
export function startAutoPurgeRunner(intervalMs = 60 * 60 * 1000): { stop: () => void } {
  let timer: NodeJS.Timeout | null = null;
  let isRunning = false;

  const run = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const purged = await runAutoPurgeCycle();
      if (purged > 0) {
        logger.info({ purged }, 'Cycle d\'auto-purge terminé avec succès');
      }
    } catch (err) {
      logger.error({ error: err instanceof Error ? err.message : 'inconnu' }, 'Erreur runner auto-purge');
    } finally {
      isRunning = false;
    }
  };

  // Premier passage différé de 10 secondes après le démarrage du worker
  const initialTimeout = setTimeout(() => {
    run().catch(() => {});
  }, 10000);

  // Exécution périodique récurrente
  timer = setInterval(() => {
    run().catch(() => {});
  }, intervalMs);

  logger.info({ intervalMs }, 'Runner d\'auto-purge (Trash & Spam) démarré');

  return {
    stop: () => {
      clearTimeout(initialTimeout);
      if (timer) clearInterval(timer);
      logger.info('Runner d\'auto-purge arrêté');
    },
  };
}
