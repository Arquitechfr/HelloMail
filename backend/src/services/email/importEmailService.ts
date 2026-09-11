import type { ImapFlow } from 'imapflow';
import type { IAccountDocument } from '../../models/Account.js';
import { MessageModel } from '../../models/Message.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../config/logger.js';
import { imapPool } from './imapPool.js';
import { folderExists } from './folderService.js';
import { mapFetchResultToMessage } from '../sync/messageMapper.js';
import { publishEvent } from '../realtime/eventPublisher.js';

const MAX_EML_SIZE = 25 * 1024 * 1024; // 25 Mo max

export interface ImportEmailResult {
  success: boolean;
  uid?: number;
  folder: string;
  message: string;
}

/**
 * Importe un email brut au format RFC 822 (.eml) dans un dossier IMAP.
 * Conserve les en-têtes et le corps intacts via client.append().
 */
export async function importEml(
  account: IAccountDocument,
  folder: string,
  emlContent: string,
  isBase64 = false,
): Promise<ImportEmailResult> {
  const accountId = String(account._id);

  if (folder === 'Snoozed') {
    throw AppError.badRequest("Impossible d'importer des messages dans le dossier virtuel En sommeil");
  }

  const buffer = isBase64
    ? Buffer.from(emlContent, 'base64')
    : Buffer.from(emlContent, 'utf-8');

  if (buffer.length === 0) {
    throw AppError.badRequest('Le fichier EML fourni est vide');
  }

  if (buffer.length > MAX_EML_SIZE) {
    throw AppError.badRequest('Le fichier dépasse la taille maximale autorisée de 25 Mo');
  }

  if (!(await folderExists(account, folder))) {
    throw AppError.notFound('Dossier de destination introuvable');
  }

  const client = await imapPool.acquire(account);

  try {
    let appendResult: { uid?: number } | undefined;
    try {
      appendResult = (await client.append(folder, buffer, ['\\Seen'])) as { uid?: number } | undefined;
    } catch (err) {
      logger.error({ err, folder, accountId }, "Erreur lors de l'append IMAP du fichier EML");
      throw AppError.unprocessable("Le serveur IMAP a refusé l'import du message");
    }

    if (appendResult?.uid) {
      await mirrorImportedMessageToMongo(client, accountId, folder, appendResult.uid);
      publishEvent({
        type: 'message:new',
        userId: String(account.userId),
        accountId,
        payload: { folder, uid: appendResult.uid },
      });
    }

    return {
      success: true,
      uid: appendResult?.uid,
      folder,
      message: 'Message importé avec succès',
    };
  } finally {
    imapPool.release(accountId);
  }
}

async function mirrorImportedMessageToMongo(
  client: ImapFlow,
  accountId: string,
  folder: string,
  uid: number,
): Promise<void> {
  try {
    await client.mailboxOpen(folder, { readOnly: true });
    const msg = await client.fetchOne(
      uid,
      {
        uid: true,
        envelope: true,
        flags: true,
        bodyStructure: true,
        size: true,
      },
      { uid: true },
    );

    if (!msg) {
      logger.warn({ accountId, folder, uid }, "Message importé introuvable pour miroir MongoDB");
      return;
    }

    const messageInput = mapFetchResultToMessage(accountId, folder, msg);
    await MessageModel.updateOne(
      { accountId, folder: messageInput.folder, uid: messageInput.uid },
      { $set: messageInput },
      { upsert: true },
    );
  } catch (err) {
    logger.warn({ err, accountId, folder, uid }, 'Erreur miroir MongoDB post-import (non bloquant)');
  }
}
