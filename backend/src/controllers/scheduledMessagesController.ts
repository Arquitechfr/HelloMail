import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  scheduleEmail,
  listScheduledEmails,
  cancelScheduledEmail,
  getScheduledEmail,
} from '../services/email/scheduledEmailService.js';

export const schedule = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { accountId } = req.params;
  const result = await scheduleEmail(req.user.id, accountId, req.body);
  res.status(201).json(result);
});

export const list = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { accountId } = req.params;
  const results = await listScheduledEmails(req.user.id, accountId);
  res.status(200).json(results);
});

export const getOne = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const result = await getScheduledEmail(req.user.id, id);
  res.status(200).json(result);
});

export const cancel = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  await cancelScheduledEmail(req.user.id, id);
  res.status(204).send();
});
