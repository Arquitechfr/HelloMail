import { Response, NextFunction } from 'express';
import { AccountModel } from '../models/Account.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { importEml } from '../services/email/importEmailService.js';

export const importEmail = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    const { accountId, folder } = req.params;
    const { emlContent, isBase64 } = req.body;

    const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
    if (!account) {
      throw AppError.notFound('Compte introuvable');
    }

    const result = await importEml(account, folder, emlContent, Boolean(isBase64));
    res.status(200).json(result);
  },
);
