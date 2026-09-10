import { Response, NextFunction } from 'express';
import { AccountModel } from '../models/Account.js';
import { MessageModel } from '../models/Message.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const list = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { accountId } = req.params;
  const folder = String(req.query.folder ?? 'INBOX');
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);

  // Vérifie que le compte appartient à l'utilisateur authentifié.
  // Ne jamais exposer l'existence d'un compte d'autrui → 404 (pas 403).
  const account = await AccountModel.findOne({ _id: accountId, userId: req.user.id });
  if (!account) {
    throw AppError.notFound('Compte introuvable');
  }

  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    MessageModel.find({ accountId, folder })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    MessageModel.countDocuments({ accountId, folder }),
  ]);

  res.status(200).json({
    data: messages,
    page,
    limit,
    total,
  });
});
