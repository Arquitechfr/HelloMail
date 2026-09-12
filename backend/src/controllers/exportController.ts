import type { Response, NextFunction } from 'express';
import { AccountModel } from '../models/Account.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { streamFolderMbox, sanitizeFolderName } from '../services/export/mboxExportService.js';
import { streamAccountZip } from '../services/export/zipExportService.js';
import { listFolders } from '../services/email/folderService.js';
import { logger } from '../config/logger.js';

/**
 * Exporte un dossier spécifique au format MBOX standard (RFC 4155 / mboxrd).
 * GET /api/accounts/:accountId/export/mbox?folder=...&exportId=...
 */
export const exportMbox = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId } = req.params;
  const folder = String(req.query.folder || '');
  const exportId = req.query.exportId ? String(req.query.exportId) : undefined;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  // Désactiver les timeouts de socket pour les téléchargements de longue durée
  req.setTimeout(0);
  res.setTimeout(0);

  const safeName = sanitizeFolderName(folder);
  const filename = `${encodeURIComponent(safeName)}.mbox`;

  res.setHeader('Content-Type', 'application/mbox; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const abortController = new AbortController();
  req.on('close', () => {
    if (!res.writableEnded) {
      logger.info({ accountId, folder }, 'Connexion fermée prématurément par le client lors de l export MBOX');
      abortController.abort();
    }
  });

  try {
    await streamFolderMbox(account, folder, res, {
      exportId,
      userId: req.user.id,
      abortSignal: abortController.signal,
    });
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      throw error;
    }
    logger.error({ error, accountId, folder }, 'Erreur en cours de streaming MBOX');
    res.destroy(error instanceof Error ? error : new Error('Erreur streaming MBOX'));
  }
});

/**
 * Exporte l'ensemble ou une sélection de dossiers sous forme d'archive ZIP contenant
 * un fichier .mbox par dossier.
 * GET /api/accounts/:accountId/export/zip?folders=...&exportId=...
 */
export const exportZip = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId } = req.params;
  const foldersQuery = req.query.folders ? String(req.query.folders) : undefined;
  const exportId = req.query.exportId ? String(req.query.exportId) : undefined;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  // Déterminer les dossiers cibles
  let targetFolders: string[] = [];
  if (foldersQuery) {
    targetFolders = foldersQuery
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean);
  } else {
    // Lister tous les dossiers IMAP du compte
    const allFolders = await listFolders(account);
    targetFolders = allFolders.map((f) => f.path);
  }

  if (targetFolders.length === 0) {
    throw AppError.badRequest('Aucun dossier sélectionné pour l export');
  }

  // Désactiver les timeouts de socket
  req.setTimeout(0);
  res.setTimeout(0);

  const dateStr = new Date().toISOString().slice(0, 10);
  const safeEmail = account.emailAddress.replace(/[^a-zA-Z0-9@._-]/g, '_');
  const filename = `mailora-${encodeURIComponent(safeEmail)}-${dateStr}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const abortController = new AbortController();
  req.on('close', () => {
    if (!res.writableEnded) {
      logger.info({ accountId }, 'Connexion fermée prématurément par le client lors de l export ZIP');
      abortController.abort();
    }
  });

  try {
    await streamAccountZip(account, targetFolders, res, {
      exportId,
      userId: req.user.id,
      abortSignal: abortController.signal,
    });
  } catch (error) {
    if (!res.headersSent) {
      throw error;
    }
    logger.error({ error, accountId }, 'Erreur en cours de streaming ZIP');
    res.destroy(error instanceof Error ? error : new Error('Erreur streaming ZIP'));
  }
});
