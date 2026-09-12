import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createOrUpdateReminder,
  getReminderForMessage,
  listReminders,
  snoozeReminder,
  dismissReminder,
  cancelReminder,
} from '../services/email/followUpReminderService.js';
import type { FollowUpReminderStatus } from '../models/FollowUpReminder.js';

export const list = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId } = req.params;
  const status = req.query.status as FollowUpReminderStatus | undefined;
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 50);

  const result = await listReminders(req.user.id, accountId, status, page, limit);
  res.status(200).json(result);
});

export const getForMessage = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, folder, uid } = req.params;
  const reminder = await getReminderForMessage(accountId, folder, Number(uid));
  res.status(200).json({ reminder });
});

export const create = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, folder, uid } = req.params;
  const reminder = await createOrUpdateReminder(
    req.user.id,
    accountId,
    folder,
    Number(uid),
    req.body,
  );
  res.status(201).json(reminder);
});

export const snooze = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, reminderId } = req.params;
  const reminder = await snoozeReminder(
    req.user.id,
    accountId,
    reminderId,
    req.body.remindAt,
  );
  res.status(200).json(reminder);
});

export const dismiss = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, reminderId } = req.params;
  const reminder = await dismissReminder(req.user.id, accountId, reminderId);
  res.status(200).json({ ok: true, reminder });
});

export const cancel = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId, reminderId } = req.params;
  const reminder = await cancelReminder(req.user.id, accountId, reminderId);
  res.status(200).json({ ok: true, reminder });
});
