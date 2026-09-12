import { ZipArchive, type ArchiverError } from 'archiver';
import { PassThrough, type Writable } from 'node:stream';
import { streamFolderMbox, sanitizeFolderName } from './mboxExportService.js';
import { publishEvent } from '../realtime/eventPublisher.js';
import { logger } from '../../config/logger.js';
import type { IAccountDocument } from '../../models/Account.js';

export interface ZipExportProgress {
  exportId?: string;
  currentFolder: string;
  folderIndex: number;
  totalFolders: number;
  totalExportedMessages: number;
  percentage: number;
}

export interface ZipExportOptions {
  exportId?: string;
  userId?: string;
  onProgress?: (progress: ZipExportProgress) => void;
  abortSignal?: AbortSignal;
}

export interface ZipExportResult {
  totalFolders: number;
  totalMessages: number;
  exportedFolders: string[];
}

/**
 * Exporte l'ensemble des dossiers IMAP sélectionnés sous forme d'archive ZIP contenant
 * un fichier .mbox par dossier, sans stockage intermédiaire sur disque.
 */
export async function streamAccountZip(
  account: IAccountDocument,
  folders: string[],
  outStream: Writable,
  options: ZipExportOptions = {},
): Promise<ZipExportResult> {
  const accountId = String(account._id);
  const totalFolders = folders.length;
  let totalMessages = 0;
  const exportedFolders: string[] = [];

  const archive = new ZipArchive({
    zlib: { level: 6 }, // Équilibre optimal compression / utilisation CPU
  });

  // Gestion des erreurs d'archivage
  archive.on('error', (err: ArchiverError) => {
    logger.error({ accountId, error: err.message }, "Erreur lors de la génération de l'archive ZIP");
  });

  archive.on('warning', (err: ArchiverError) => {
    logger.warn({ accountId, warning: err.message }, "Avertissement archiver");
  });

  // Brancher l'archive sur le flux de sortie HTTP
  archive.pipe(outStream);

  // Écoute de l'interruption prématurée
  if (options.abortSignal) {
    options.abortSignal.addEventListener('abort', () => {
      logger.info({ accountId }, "Abandon de l'exportation ZIP suite à l'interruption client");
      archive.abort();
    });
  }

  try {
    for (let i = 0; i < folders.length; i += 1) {
      if (options.abortSignal?.aborted) {
        break;
      }

      const folder = folders[i];
      const safeName = sanitizeFolderName(folder);
      const folderPassThrough = new PassThrough();

      // Ajouter l'entrée MBOX au sein du conteneur ZIP
      archive.append(folderPassThrough, { name: `${safeName}.mbox` });

      const progressCallback = (current: number, total: number, _percentage: number): void => {
        const folderRatio = i / totalFolders;
        const currentFolderRatio = total > 0 ? (current / total) * (1 / totalFolders) : 0;
        const overallPercentage = Math.min(100, Math.round((folderRatio + currentFolderRatio) * 100));

        const progressData: ZipExportProgress = {
          exportId: options.exportId,
          currentFolder: folder,
          folderIndex: i + 1,
          totalFolders,
          totalExportedMessages: totalMessages + current,
          percentage: overallPercentage,
        };

        options.onProgress?.(progressData);
      };

      try {
        const result = await streamFolderMbox(account, folder, folderPassThrough, {
          exportId: options.exportId,
          userId: options.userId,
          onProgress: progressCallback,
          abortSignal: options.abortSignal,
        });

        totalMessages += result.exportedCount;
        exportedFolders.push(folder);
      } finally {
        // Toujours clore le sous-flux pour finaliser le fichier dans l'archive
        folderPassThrough.end();
      }

      // Progression intermédiaire globale après chaque dossier
      const folderPercentage = Math.round(((i + 1) / totalFolders) * 100);
      if (options.userId) {
        await publishEvent({
          type: 'export:progress',
          accountId,
          userId: options.userId,
          payload: {
            exportId: options.exportId,
            currentFolder: folder,
            folderIndex: i + 1,
            totalFolders,
            totalExportedMessages: totalMessages,
            percentage: folderPercentage,
          },
        });
      }
    }

    // Finaliser et purger l'archive ZIP
    await archive.finalize();

    return {
      totalFolders: exportedFolders.length,
      totalMessages,
      exportedFolders,
    };
  } catch (err) {
    archive.abort();
    throw err;
  }
}
