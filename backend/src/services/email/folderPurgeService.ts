import type { IAccountDocument } from '../../models/Account.js';
import { MessageModel } from '../../models/Message.js';
import { MessageBodyModel } from '../../models/MessageBody.js';
import { AppError } from '../../utils/AppError.js';
import { imapPool } from './imapPool.js';
import { findTrashFolder, findJunkFolder } from './specialFolders.js';
import { setFolderCounts, adjustFolderCounters } from './folderCounters.js';
import { publishEvent } from '../realtime/eventPublisher.js';
import { logger } from '../../config/logger.js';

const PURGEABLE_NAMES = new Set([
  'trash',
  'corbeille',
  'deleted',
  'deleted items',
  'bin',
  'junk',
  'spam',
  'junk mail',
  'junk email',
  'courrier indésirable',
  'indésirables',
]);

/**
 * Détermine si un dossier est éligible au vidage intégral (uniquement Corbeille et Spams).
 */
export async function isPurgeableFolder(
  account: IAccountDocument,
  folderPath: string,
): Promise<boolean> {
  const norm = folderPath.toLowerCase().trim();
  if (PURGEABLE_NAMES.has(norm)) {
    return true;
  }

  const [trashPath, junkPath] = await Promise.all([
    findTrashFolder(account).catch(() => null),
    findJunkFolder(account).catch(() => null),
  ]);

  if (trashPath && trashPath.toLowerCase().trim() === norm) return true;
  if (junkPath && junkPath.toLowerCase().trim() === norm) return true;

  return false;
}

/**
 * Vide intégralement un dossier (uniquement Trash ou Junk).
 * Supprime tous les messages côté IMAP et en base de données MongoDB,
 * réinitialise les compteurs de dossier à 0 et notifie le frontend.
 */
export async function emptyFolder(
  account: IAccountDocument,
  folderPath: string,
): Promise<{ deletedCount: number; folder: string }> {
  const isAllowed = await isPurgeableFolder(account, folderPath);
  if (!isAllowed) {
    throw AppError.forbidden(
      `Le dossier « ${folderPath} » ne peut pas être vidé. Seuls les dossiers Corbeille et Courrier indésirable sont autorisés.`,
    );
  }

  const accountId = String(account._id);
  const client = await imapPool.acquire(account);

  try {
    const mailbox = await client.mailboxOpen(folderPath, { readOnly: false });

    // Si le dossier distant contient des messages, les supprimer tous en une passe
    if (mailbox.exists > 0) {
      await client.messageDelete('1:*', { uid: false });
    }

    // Purge locale atomique des messages et des corps en cache
    const deleteResult = await MessageModel.deleteMany({ accountId: account._id, folder: folderPath });
    await MessageBodyModel.deleteMany({ accountId: account._id, folder: folderPath });

    // Réinitialisation des compteurs de cache à zéro
    await setFolderCounts(accountId, folderPath, { messages: 0, unseen: 0 });

    // Notification temps réel SSE pour tous les onglets connectés
    publishEvent({
      type: 'message:deleted',
      accountId,
      userId: String(account.userId),
      payload: { folder: folderPath, all: true },
    }).catch(() => {});

    logger.info(
      { accountId, folder: folderPath, deletedCount: deleteResult.deletedCount },
      'Dossier vidé avec succès',
    );

    return {
      deletedCount: deleteResult.deletedCount,
      folder: folderPath,
    };
  } finally {
    imapPool.release(accountId);
  }
}

/**
 * Purge les messages d'un dossier dont la date d'ancienneté dépasse le seuil de rétention configuré.
 */
export async function purgeOldMessages(
  account: IAccountDocument,
  folderPath: string,
  retentionDays: number,
): Promise<number> {
  if (retentionDays <= 0) return 0;

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const accountId = String(account._id);

  const oldMessages = await MessageModel.find({
    accountId: account._id,
    folder: folderPath,
    date: { $lt: cutoff },
  })
    .select('uid flags.seen')
    .limit(200)
    .lean();

  if (oldMessages.length === 0) return 0;

  const uids = oldMessages.map((m) => m.uid);
  const client = await imapPool.acquire(account);

  try {
    await client.mailboxOpen(folderPath, { readOnly: false });
    await client.messageDelete(uids, { uid: true });

    await MessageModel.deleteMany({
      accountId: account._id,
      folder: folderPath,
      uid: { $in: uids },
    });
    await MessageBodyModel.deleteMany({
      accountId: account._id,
      folder: folderPath,
      uid: { $in: uids },
    });

    const unseenCount = oldMessages.filter((m) => m.flags?.seen === false).length;
    await adjustFolderCounters(accountId, folderPath, {
      messagesDelta: -uids.length,
      unseenDelta: -unseenCount,
    });

    publishEvent({
      type: 'message:deleted',
      accountId,
      userId: String(account.userId),
      payload: { folder: folderPath, uids },
    }).catch(() => {});

    logger.info(
      { accountId, folder: folderPath, count: uids.length, retentionDays },
      'Messages anciens purgés automatiquement',
    );

    return uids.length;
  } finally {
    imapPool.release(accountId);
  }
}
