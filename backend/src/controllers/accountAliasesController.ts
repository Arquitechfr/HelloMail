import { Response, NextFunction } from 'express';
import { AliasService } from '../services/accounts/aliasService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const list = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const aliases = await AliasService.listAliases(req.user.id, req.params.id);
  res.status(200).json(aliases);
});

export const create = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const alias = await AliasService.createAlias(req.user.id, req.params.id, req.body);
  res.status(201).json(alias);
});

export const update = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const alias = await AliasService.updateAlias(req.user.id, req.params.id, req.params.aliasId, req.body);
  res.status(200).json(alias);
});

export const remove = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  await AliasService.deleteAlias(req.user.id, req.params.id, req.params.aliasId);
  res.status(204).send();
});

export const updateSignature = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const signature = await AliasService.updateAliasSignature(req.user.id, req.params.id, req.params.aliasId, req.body);
  res.status(200).json(signature);
});
