import { Response } from 'express';
import { PgpKeyService } from '../services/security/pgpKeyService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import {
  saveUserKeySchema,
  saveContactKeySchema,
  pgpKeyParamsSchema,
  pgpEmailParamsSchema,
} from '../schemas/pgpSchemas.js';

export const getMyKeys = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const keys = await PgpKeyService.getUserKeys(req.user.id);
  res.status(200).json({ data: keys });
});

export const saveMyKey = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = saveUserKeySchema.parse(req.body);
  const key = await PgpKeyService.saveUserKey(req.user.id, parsed);
  res.status(201).json({ data: key });
});

export const deleteMyKey = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { keyId } = pgpKeyParamsSchema.parse(req.params);
  await PgpKeyService.deleteUserKey(req.user.id, keyId);
  res.status(204).send();
});

export const getContactKey = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { email } = pgpEmailParamsSchema.parse(req.params);
  const key = await PgpKeyService.getContactPublicKey(req.user.id, email);
  res.status(200).json({ data: key });
});

export const listContactKeys = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const keys = await PgpKeyService.listContactPublicKeys(req.user.id);
  res.status(200).json({ data: keys });
});

export const saveContactKey = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = saveContactKeySchema.parse(req.body);
  const key = await PgpKeyService.saveContactPublicKey(req.user.id, parsed);
  res.status(201).json({ data: key });
});

export const deleteContactKey = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { keyId } = pgpKeyParamsSchema.parse(req.params);
  await PgpKeyService.deleteContactPublicKey(req.user.id, keyId);
  res.status(204).send();
});
