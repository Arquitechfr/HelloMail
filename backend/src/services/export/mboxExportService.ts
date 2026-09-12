import { pipeline } from 'node:stream/promises';
import type { Writable } from 'node:stream';
import { imapPool } from '../email/imapPool.js';
import { MessageModel } from '../../models/Message.js';
import { MboxTransformStream } from './mboxTransformStream.js';
import { publishEvent } from '../realtime/eventPublisher.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../utils/AppError.js';
import type { IAccountDocument } from '../../models/Account.js';

export interface MboxExportOptions {
  exportId?: string;
  userId?: string;
  onProgress?: (current: number, total: number, percentage: number) => void;
  abortSignal?: AbortSignal;
}

export interface MboxExportResult {
  exportedCount: number;
  folder: string;
}

/**
 * Assainit un nom de dossier pour un usage sûr dans les chemins de fichiers.
 */
export function sanitizeFolderName(folder: string): string {
  return folder
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/^\.+/, '')
    .trim() || 'Dossier';
}

/**
 * Exporte un dossier IMAP sous forme de flux MBOX (RFC 4155 / mboxrd).
 * Utilise un pipeline séquentiel avec backpressure natif pour garantir une empreinte
 * mémoire constante (< 20 Mo) sans saturer le serveur.
 */
export async function streamFolderMbox(
  account: IAccountDocument,
  folder: string,
  outStream: Writable,
  options: MboxExportOptions = {},
): Promise<MboxExportResult> {
  const accountId = String(account._id);
  const client = await imapPool.acquire(account);

  try {
    const mailbox = await client.mailboxOpen(folder, { readOnly: true });
    if (!mailbox) {
      throw AppError.notFound(`Dossier IMAP introuvable : ${folder}`);
    }

    // Récupérer les métadonnées pré-indexées en base pour limiter les allers-retours IMAP
    const localMessages = await MessageModel.find({
      accountId: account._id,
      folder,
    })
      .select('uid from date')
      .lean();

    const localMetaMap = new Map<number, { from?: string; date?: Date }>();
    for (const msg of localMessages) {
      localMetaMap.set(msg.uid, {
        from: msg.from?.address,
        date: msg.date,
      });
    }

    // Récupération des UIDs réels sur le serveur IMAP
    const searchResult = await client.search({ all: true }, { uid: true });
    const uids: number[] = Array.isArray(searchResult) ? searchResult : [];
    const total = uids.length;

    if (total === 0) {
      return { exportedCount: 0, folder };
    }

    let exported = 0;

    for (const uid of uids) {
      if (options.abortSignal?.aborted) {
        logger.info({ accountId, folder, exported, total }, "Export MBOX interrompu par l'utilisateur");
        break;
      }

      // Métadonnées d'enveloppe
      let fromAddress: string | undefined = localMetaMap.get(uid)?.from;
      let msgDate: Date | undefined = localMetaMap.get(uid)?.date;

      if (!fromAddress || !msgDate) {
        try {
          const info = await client.fetchOne(uid, { envelope: true }, { uid: true });
          if (info && info.envelope) {
            fromAddress = info.envelope.from?.[0]?.address || fromAddress;
            msgDate = info.envelope.date ? new Date(info.envelope.date) : msgDate;
          }
        } catch {
          // Ignorer les erreurs d'enveloppe non-bloquantes
        }
      }

      // Téléchargement du flux brut RFC 822
      const { content } = await client.download(uid, undefined, { uid: true });
      const transform = new MboxTransformStream({ fromAddress, date: msgDate });

      // Écriture du message transformé sans fermer le stream de sortie
      await pipeline(content, transform, outStream, { end: false });
      exported += 1;

      const percentage = Math.round((exported / total) * 100);
      options.onProgress?.(exported, total, percentage);

      // Notification SSE périodique (tous les 10 messages ou fin)
      if (options.userId && (exported % 10 === 0 || exported === total)) {
        await publishEvent({
          type: 'export:progress',
          accountId,
          userId: options.userId,
          payload: {
            exportId: options.exportId,
            folder,
            current: exported,
            total,
            percentage,
          },
        });
      }
    }

    return { exportedCount: exported, folder };
  } finally {
    imapPool.release(accountId);
  }
}
