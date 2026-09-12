import { Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import {
  getUnifiedMessages,
  getUnifiedStatus,
  UnifiedFolderType,
} from '../services/email/unifiedMessagesService.js';
import { searchUnifiedMessages } from '../services/email/unifiedSearchService.js';

export const listMessages = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    const type = (req.query.type as UnifiedFolderType) || 'inbox';
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 50);
    const tag = req.query.tag ? String(req.query.tag) : undefined;

    const result = await getUnifiedMessages(req.user.id, {
      type,
      page,
      limit,
      tag,
    });

    res.status(200).json(result);
  },
);

export const searchMessages = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    const result = await searchUnifiedMessages(req.user.id, req.query as never);
    res.status(200).json(result);
  },
);

export const getStatus = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    const result = await getUnifiedStatus(req.user.id);
    res.status(200).json(result);
  },
);
