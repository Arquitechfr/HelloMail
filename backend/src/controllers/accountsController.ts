import { Response, NextFunction } from 'express';
import { AccountService } from '../services/accounts/accountService.js';
import { detectEmailConfig } from '../services/accounts/autoconfigService.js';
import { syncAccountOnDemand } from '../services/email/onDemandSyncService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const create = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const account = await AccountService.createImapAccount(req.user.id, req.body);
  res.status(201).json(account);
});

export const list = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const accounts = await AccountService.listAccounts(req.user.id);
  res.status(200).json(accounts);
});

export const remove = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  await AccountService.deleteAccount(req.user.id, req.params.id);
  res.status(204).send();
});

export const toggleActive = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    const account = await AccountService.toggleAccountActive(
      req.user.id,
      req.params.id,
      req.body.isActive,
    );
    res.status(200).json(account);
  },
);

export const autoconfig = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    const email = req.query.email as string;
    const config = await detectEmailConfig(email);
    res.status(200).json(config);
  },
);

export const updateSignature = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    const account = await AccountService.updateSignature(
      req.user.id,
      req.params.id,
      req.body,
    );
    res.status(200).json(account);
  },
);

export const update = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    const account = await AccountService.updateAccount(
      req.user.id,
      req.params.id,
      req.body,
    );
    res.status(200).json(account);
  },
);

export const getQuota = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    const forceRefresh = req.query.refresh === 'true';
    const quota = await AccountService.getAccountQuota(
      req.user.id,
      req.params.id,
      forceRefresh,
    );
    res.status(200).json(quota);
  },
);

export const syncOnDemand = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    const folder = req.query.folder ? String(req.query.folder) : undefined;
    const result = await syncAccountOnDemand(req.params.id, req.user.id, folder);
    res.status(200).json(result);
  },
);

