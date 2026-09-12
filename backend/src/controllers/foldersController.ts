import { Response, NextFunction } from 'express';
import { AccountModel } from '../models/Account.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import {
  listFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  getFolderStatus,
} from '../services/email/folderService.js';
import { emptyFolder } from '../services/email/folderPurgeService.js';

export const list = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const folders = await listFolders(account);
  res.status(200).json(folders);
});

export const create = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  await createFolder(account, req.body.path);
  res.status(201).json({ path: req.body.path });
});

export const rename = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, path } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  await renameFolder(account, path, req.body.newPath);
  res.status(200).json({ path: req.body.newPath });
});

export const remove = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, path } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  await deleteFolder(account, path);
  res.status(204).send();
});

export const status = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, path } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const result = await getFolderStatus(account, path);
  res.status(200).json(result);
});

export const empty = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, path } = req.params;

  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const result = await emptyFolder(account, path);
  res.status(200).json(result);
});
