import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';

export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`Route introuvable : ${req.method} ${req.originalUrl}`));
}
