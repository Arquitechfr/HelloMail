import { AccountModel } from '../../models/Account.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../config/logger.js';
import { imapPool } from './imapPool.js';
import { runInitialSyncForFolder, runInitialSyncAll } from '../sync/initialSync.js';
import { reconcileFolder } from '../sync/reconcileFolder.js';
import { reconcileAllFolders } from '../sync/reconcileAllFolders.js';
import { syncFolderCacheFromClient, resolveCanonicalFolder } from './folderService.js';
import { publishEvent } from '../realtime/eventPublisher.js';

export interface OnDemandSyncResult {
  success: boolean;
  syncedCount: number;
  deletedCount: number;
  folder: string;
  syncedAt: string;
}

/**
 * Synchronise un compte IMAP à la demande via le pool IMAP de l'API.
 * Rapatrie les nouveaux messages, réconcilie les suppressions et met à jour les caches.
 */
export async function syncAccountOnDemand(
  accountId: string,
  userId: string,
  folderParam?: string,
): Promise<OnDemandSyncResult> {
  const account = await AccountModel.findOne({ _id: accountId, userId });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  if (!account.isActive) {
    throw AppError.badRequest('Ce compte est désactivé');
  }

  const client = await imapPool.acquire(account);
  let syncedCount = 0;
  let deletedCount = 0;
  let targetFolder = 'ALL';

  try {
    if (folderParam) {
      targetFolder = await resolveCanonicalFolder(accountId, folderParam);
      // Synchronise le dossier demandé
      syncedCount = await runInitialSyncForFolder(client, accountId, targetFolder, userId);
      deletedCount = await reconcileFolder(client, accountId, targetFolder);

      // Rafraîchit le cache des dossiers en base (compteurs autoritaires)
      await syncFolderCacheFromClient(client, accountId).catch(() => {});

      // Émission d'événements SSE pour mise à jour instantanée du client
      if (syncedCount > 0) {
        publishEvent({
          type: 'message:new',
          accountId,
          userId,
          payload: { folder: targetFolder },
        }).catch(() => {});
      }

      if (deletedCount > 0) {
        publishEvent({
          type: 'message:deleted',
          accountId,
          userId,
          payload: { folder: targetFolder },
        }).catch(() => {});
      }
    } else {
      // Synchronisation de tous les dossiers principaux (INBOX + spéciaux)
      syncedCount = await runInitialSyncAll(client, accountId, account);
      deletedCount = await reconcileAllFolders(client, accountId, account);

      if (syncedCount > 0) {
        publishEvent({
          type: 'message:new',
          accountId,
          userId,
          payload: { folder: 'INBOX' },
        }).catch(() => {});
      }

      if (deletedCount > 0) {
        publishEvent({
          type: 'message:deleted',
          accountId,
          userId,
          payload: { folder: 'INBOX' },
        }).catch(() => {});
      }
    }

    const now = new Date();
    await AccountModel.updateOne(
      { _id: account._id },
      { lastSyncedAt: now, $unset: { lastSyncError: '' } },
    );

    logger.info(
      { accountId, folder: targetFolder, syncedCount, deletedCount },
      'Synchronisation à la demande réussie',
    );

    return {
      success: true,
      syncedCount,
      deletedCount,
      folder: targetFolder,
      syncedAt: now.toISOString(),
    };
  } finally {
    imapPool.release(accountId);
  }
}
