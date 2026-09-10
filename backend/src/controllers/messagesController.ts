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

export const list = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId } = req.params;
  const folderParam = req.query.folder ? String(req.query.folder) : undefined;
  const tagParam = req.query.tag ? String(req.query.tag) : undefined;
  const folder = folderParam ?? (tagParam ? undefined : 'INBOX');
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);

  // Vérifie que le compte appartient à l'utilisateur authentifié.
  // Ne jamais exposer l'existence d'un compte d'autrui → 404 (pas 403).
  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const filter: Record<string, unknown> = { accountId };
  if (folder) filter.folder = folder;
  if (tagParam) filter.tags = tagParam;

  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    MessageModel.find(filter)
      .sort({ date: -1 })
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

  const result = await searchMessages(account, req.query as never);
  res.status(200).json(result);
});

export const getOne = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, folder, uid } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const detail = await fetchMessageDetail(account, folder, Number(uid));
  res.status(200).json(detail);
});

export const getAttachment = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, folder, uid, part } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const { stream, contentType, filename, size } = await fetchAttachmentStream(
    account,
    folder,
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

  const { stream, contentType, filename, size } = await fetchRawMessageStream(
    account,
    folder,
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

  await updateMessageFlags(account, folder, Number(uid), req.body);
  res.status(200).json({ ok: true });
});

export const remove = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, folder, uid } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const permanent = req.query.permanent === 'true';
  await deleteMessage(account, folder, Number(uid), permanent);
  res.status(204).send();
});

export const move = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, folder, uid } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  await moveMessage(account, folder, Number(uid), req.body.destination);
  res.status(200).json({ ok: true });
});

export const markAsJunk = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, folder, uid } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  await markMessageAsJunk(account, folder, Number(uid));
  res.status(200).json({ ok: true });
});

export const batch = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId } = req.params;
  const folder = String(req.body.folder ?? req.query.folder ?? 'INBOX');

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

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

  const result = await fetchMoreMessages(account, req.body.folder, req.body.count);
  res.status(200).json(result);
});

export const getThread = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, folder, uid } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const thread = await getConversationThread(accountId, folder, Number(uid));
  res.status(200).json(thread);
});

export const sendReceipt = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, folder, uid } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const result = await sendReadReceipt(account, folder, Number(uid));
  res.status(200).json(result);
});

