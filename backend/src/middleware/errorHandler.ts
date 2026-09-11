import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * Middleware de gestion d'erreurs centralisé.
 * Ordre de résolution :
 * 1. ZodError → 400 avec fieldErrors
 * 2. Mongoose ValidationError → 400
 * 3. AppError → statusCode du message
 * 4. Erreurs body-parser/Express (entity.too.large → 413, entity.parse.failed → 400)
 * 5. Sinon → 500, message générique en production
 *
 * Ne loggue jamais req.body (peut contenir des secrets en clair).
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        message: 'Erreur de validation des données',
        details: err.flatten().fieldErrors,
      },
    });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({
      error: {
        message: 'Erreur de validation des données',
        details: err.errors,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { message: err.message },
    });
    return;
  }

  // Erreurs des middlewares Express/body-parser — elles portent `type` + `status`.
  const bodyParserStatus = (err as { status?: number; statusCode?: number }).status
    ?? (err as { statusCode?: number }).statusCode;
  if (typeof bodyParserStatus === 'number' && bodyParserStatus >= 400 && bodyParserStatus < 500) {
    const errType = (err as { type?: string }).type;
    const message =
      errType === 'entity.too.large'
        ? 'Corps de requête trop volumineux'
        : errType === 'entity.parse.failed'
          ? 'Corps JSON invalide'
          : 'Requête invalide';
    res.status(bodyParserStatus).json({ error: { message } });
    return;
  }

  logger.error({ error: err.message, stack: err.stack }, 'Erreur non gérée');
  res.status(500).json({
    error: {
      message: env.NODE_ENV === 'production' ? 'Une erreur interne est survenue' : String(err),
    },
  });
};
