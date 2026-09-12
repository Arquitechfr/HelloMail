import { AccountModel, type IAccountDocument, type IStorageQuota } from '../../models/Account.js';
import { imapPool } from './imapPool.js';
import { logger } from '../../config/logger.js';

/** Durée de validité du cache de quota IMAP en base (15 minutes). */
export const QUOTA_CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Récupère le quota IMAP (RFC 2087) pour un compte donné.
 *
 * Utilise la valeur en cache si elle a moins de 15 minutes, sauf si `forceRefresh` est vrai.
 * En cas de serveur ne supportant pas l'extension QUOTA, enregistre et retourne `supported: false`.
 */
export async function getAccountQuota(
  account: IAccountDocument,
  forceRefresh = false,
): Promise<IStorageQuota> {
  const accountId = String(account._id);

  // Vérification de la fraîcheur du cache
  if (
    !forceRefresh &&
    account.storageQuota?.updatedAt &&
    Date.now() - new Date(account.storageQuota.updatedAt).getTime() < QUOTA_CACHE_TTL_MS
  ) {
    return account.storageQuota;
  }

  const client = await imapPool.acquire(account);

  try {
    const rawQuota = await client.getQuota('INBOX');

    let quotaData: IStorageQuota;

    if (!rawQuota || typeof rawQuota !== 'object') {
      quotaData = {
        supported: false,
        updatedAt: new Date(),
      };
    } else {
      const usedBytes = rawQuota.storage?.used ?? 0;
      const totalBytes = rawQuota.storage?.limit ?? 0;
      const percentage =
        totalBytes > 0 ? Math.min(100, Math.round((usedBytes / totalBytes) * 100)) : 0;

      quotaData = {
        supported: true,
        usedBytes,
        totalBytes,
        percentage,
        usedMessages: rawQuota.messages?.used,
        totalMessages: rawQuota.messages?.limit,
        updatedAt: new Date(),
      };
    }

    await AccountModel.updateOne(
      { _id: account._id },
      { $set: { storageQuota: quotaData } },
    );
    account.storageQuota = quotaData;

    return quotaData;
  } catch (error) {
    logger.warn(
      { accountId, error: error instanceof Error ? error.message : 'erreur inconnue' },
      'Échec récupération quota IMAP',
    );

    if (account.storageQuota) {
      return account.storageQuota;
    }

    return {
      supported: false,
      updatedAt: new Date(),
    };
  } finally {
    imapPool.release(accountId);
  }
}
