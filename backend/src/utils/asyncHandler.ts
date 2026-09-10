import { Request, Response, NextFunction } from 'express';

/**
 * Wrapper qui élimine le try/catch répétitif dans les controllers.
 * Toute erreur non catchée remonte automatiquement à errorHandler.
 *
 * Usage : router.post('/', asyncHandler(controller.create))
 */
export const asyncHandler =
  <T extends Request = Request>(
    fn: (req: T, res: Response, next: NextFunction) => Promise<void> | void,
  ) =>
  (req: Request, res: Response, next: NextFunction): Promise<void> =>
    Promise.resolve(fn(req as T, res, next)).catch(next);
