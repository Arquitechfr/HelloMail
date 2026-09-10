import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';

interface ValidationTargets {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

/**
 * Factory de validation Zod pour body, params et query.
 * Ne loggue jamais req.body brut (peut contenir des secrets en clair).
 * Loggue uniquement les issues Zod (chemins + messages).
 */
export function validate(schemas: ValidationTargets) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params) as any;
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query) as any;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(AppError.badRequest('Erreur de validation des données'));
        return;
      }
      next(error);
    }
  };
}
