import { Response, NextFunction } from 'express';
import { AccountModel } from '../models/Account.js';
import { MessageModel } from '../models/Message.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { fetchMessageDetail } from '../services/email/messageFetchService.js';
import { fetchAttachmentStream, fetchRawMessageStream } from '../services/email/attachmentService.js';
import { sendEmail } from '../services/email/sendService.js';
import { searchMessages } from '../services/email/searchService.js';
import { importSearchResultsFromServer, shouldSearchServer } from '../services/email/imapSearchService.js';
import { fetchMoreMessages } from '../services/email/fetchMoreService.js';
import { getConversationThread } from '../services/email/threadService.js';
import { sendReadReceipt } from '../services/email/receiptService.js';
import {
  updateFlags as updateMessageFlags,
  deleteMessage,
  moveMessage,
  markMessageAsJunk,
  batchAction,
} from '../services/email/messageActionService.js';
import { snoozeMessage } from '../services/email/snoozeService.js';
import { pinMessage } from '../services/email/pinService.js';
import { folderExists, folderPathExists, resolveCanonicalFolder, resolveMessageFolder, VIRTUAL_SNOOZED_FOLDER } from '../services/email/folderService.js';
import { logger } from '../config/logger.js';

export const list = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId } = req.params;
  const folderParam = req.query.folder ? String(req.query.folder) : undefined;
  const tagParam = req.query.tag ? String(req.query.tag) : undefined;
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);

  // Vérifie que le compte appartient à l'utilisateur authentifié.
  // Ne jamais exposer l'existence d'un compte d'autrui → 404 (pas 403).
  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  // Canonicalise l'alias de la boîte de réception (ex. « Boîte de réception »
  // chez Zoho, flag \Inbox) vers 'INBOX', le nom de stockage en base.
  const resolvedFolder = folderParam ? await resolveCanonicalFolder(accountId, folderParam) : undefined;
  const folder = resolvedFolder ?? (tagParam ? undefined : 'INBOX');

  // Désambiguïsation du dossier virtuel « En sommeil » : '__snoozed__' est
  // toujours virtuel ; 'Snoozed' n'est virtuel que si aucun vrai dossier de
  // ce nom n'existe (certains serveurs, ex. Zoho, ont un dossier « Snoozed »).
  const isVirtualSnoozed =
    folder === VIRTUAL_SNOOZED_FOLDER ||
    (folder === 'Snoozed' && !(await folderPathExists(accountId, 'Snoozed')));

  // Valide l'existence du dossier via le cache Folder (D10).
  // Bypass : dossier virtuel « En sommeil » et requêtes filtrées par tag (folder libre).
  // Si le cache n'est pas peuplé, folderExists dégrade en permissif.
  if (folder && !isVirtualSnoozed && !(await folderExists(account, folder))) {
    throw AppError.notFound('Dossier introuvable');
  }

  const filter: Record<string, unknown> = { accountId };
  const sortOption: Record<string, 1 | -1> =
    isVirtualSnoozed ? { isPinned: -1, snoozedUntil: 1 } : { isPinned: -1, date: -1 };

  if (isVirtualSnoozed) {
    filter.snoozedUntil = { $gt: new Date() };
  } else {
    if (folder) filter.folder = folder;
    filter.snoozedUntil = { $not: { $gt: new Date() } };
  }
  if (tagParam) filter.tags = tagParam;

  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    MessageModel.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean(),
    MessageModel.countDocuments(filter),
  ]);

  res.status(200).json({
    data: messages,
    page,
    limit,
    total,
  });
});

export const search = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const query = req.query as never as Parameters<typeof searchMessages>[1];
  // Canonicalise un éventuel alias de boîte de réception (ex. nom localisé).
  if (query.folder) {
    query.folder = await resolveCanonicalFolder(accountId, query.folder);
  }
  const result = await searchMessages(account, query);

  // Fallback automatique : si les résultats locaux sont insuffisants,
  // on interroge le serveur IMAP (messages au-delà du périmètre synchronisé),
  // on importe les envelopes en base puis on rejoue la requête locale.
  if (shouldSearchServer(query, result.total)) {
    try {
      const imported = await importSearchResultsFromServer(account, query);
      if (imported > 0) {
        const refreshed = await searchMessages(account, query);
        res.status(200).json({ ...refreshed, source: 'server' });
        return;
      }
    } catch (error) {
      // Repli gracieux sur les résultats locaux — une panne IMAP ne doit
      // pas faire échouer la recherche.
      logger.warn(
        { accountId, error: error instanceof Error ? error.message : 'erreur inconnue' },
        'Recherche serveur échouée, repli sur les résultats locaux',
      );
    }
  }

  res.status(200).json({ ...result, source: 'local' });
});

export const getOne = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, folder, uid } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const realFolder = await resolveMessageFolder(accountId, folder, Number(uid));
  const detail = await fetchMessageDetail(account, realFolder, Number(uid));
  res.status(200).json(detail);
});

export const getAttachment = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, folder, uid, part } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const realFolder = await resolveMessageFolder(accountId, folder, Number(uid));
  const { stream, contentType, filename, size } = await fetchAttachmentStream(
    account,
    realFolder,
    Number(uid),
    part,
  );

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  if (size > 0) {
    res.setHeader('Content-Length', String(size));
  }

  stream.pipe(res);
});

export const getRaw = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, folder, uid } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const realFolder = await resolveMessageFolder(accountId, folder, Number(uid));
  const { stream, contentType, filename, size } = await fetchRawMessageStream(
    account,
    realFolder,
    Number(uid),
  );

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  if (size > 0) {
    res.setHeader('Content-Length', String(size));
  }

  stream.pipe(res);
});

export const send = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const result = await sendEmail(account, req.body);
  res.status(202).json(result);
});

export const updateFlags = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, folder, uid } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const realFolder = await resolveMessageFolder(accountId, folder, Number(uid));
  await updateMessageFlags(account, realFolder, Number(uid), req.body);
  res.status(200).json({ ok: true });
});

export const remove = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, folder, uid } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const permanent = req.query.permanent === 'true';
  const realFolder = await resolveMessageFolder(accountId, folder, Number(uid));
  await deleteMessage(account, realFolder, Number(uid), permanent);
  res.status(204).send();
});

export const move = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, folder, uid } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const realFolder = await resolveMessageFolder(accountId, folder, Number(uid));
  await moveMessage(account, realFolder, Number(uid), req.body.destination);
  res.status(200).json({ ok: true });
});

export const markAsJunk = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, folder, uid } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const realFolder = await resolveMessageFolder(accountId, folder, Number(uid));
  await markMessageAsJunk(account, realFolder, Number(uid));
  res.status(200).json({ ok: true });
});

export const batch = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId } = req.params;
  const requestedFolder = String(req.body.folder ?? req.query.folder ?? 'INBOX');

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const folder = await resolveCanonicalFolder(accountId, requestedFolder);

  const result = await batchAction(
    account,
    folder,
    req.body.uids,
    req.body.action,
    req.body.destination,
  );
  res.status(200).json(result);
});

export const fetchMore = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const folder = await resolveCanonicalFolder(accountId, req.body.folder);
  const result = await fetchMoreMessages(account, folder, req.body.count);
  res.status(200).json(result);
});

export const getThread = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, folder, uid } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const realFolder = await resolveMessageFolder(accountId, folder, Number(uid));
  const thread = await getConversationThread(accountId, realFolder, Number(uid));
  res.status(200).json(thread);
});

export const sendReceipt = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, folder, uid } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const realFolder = await resolveMessageFolder(accountId, folder, Number(uid));
  const result = await sendReadReceipt(account, realFolder, Number(uid));
  res.status(200).json(result);
});

export const snooze = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, folder, uid } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const snoozedUntilDate = req.body.snoozedUntil ? new Date(req.body.snoozedUntil) : null;
  const message = await snoozeMessage(account, folder, Number(uid), snoozedUntilDate);
  res.status(200).json({ ok: true, data: message });
});

export const pin = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, folder, uid } = req.params;
  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const message = await pinMessage(account, folder, Number(uid), Boolean(req.body.isPinned));
  res.status(200).json(message);
});


