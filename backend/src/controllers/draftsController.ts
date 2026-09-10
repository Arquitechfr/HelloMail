import { Response, NextFunction } from 'express';
import { AccountModel } from '../models/Account.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { saveDraft, deleteDraft } from '../services/email/draftService.js';

export const create = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const result = await saveDraft(account, req.body);
  res.status(201).json(result);
});

export const update = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, uid } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const result = await saveDraft(account, req.body, Number(uid));
  res.status(200).json(result);
});

export const remove = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, uid } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  await deleteDraft(account, Number(uid));
  res.status(204).send();
});
