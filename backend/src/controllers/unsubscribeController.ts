import { Response, NextFunction } from 'express';
import { AccountModel } from '../models/Account.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { executeUnsubscribe } from '../services/email/unsubscribeService.js';

export const unsubscribe = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    const { accountId, folder, uid } = req.params;

    const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
    if (!account) {
      throw AppError.notFound('Compte introuvable');
    }

    const result = await executeUnsubscribe(account, folder, Number(uid));
    res.status(200).json(result);
  },
);
