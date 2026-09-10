import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { logger } from '../config/logger.js';

interface ValidationTargets {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

/**
 * Factory de validation Zod pour body, params et query.
 * Ne loggue jamais req.body brut (peut contenir des secrets en clair).
 * Loggue uniquement les issues Zod (chemins + messages).
 *
 * La ZodError est laissée passer au errorHandler centralisé (qui la gère
 * avec `err.flatten().fieldErrors`) — ne l'encapsule pas en AppError pour
 * préserver les détails de validation retournés au client.
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
      // Laisse passer la ZodError au errorHandler (gère les fieldErrors).
      // Loggue les issues Zod pour le debug, jamais req.body brut.
      if (error && typeof error === 'object' && 'issues' in error) {
        logger.warn({ issues: (error as { issues: unknown }).issues }, 'Erreur de validation');
      }
      next(error);
    }
  };
}
