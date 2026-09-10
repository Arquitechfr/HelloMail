import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

/**
 * Middleware de gestion d'erreurs centralisé.
 * Ordre de résolution :
 * 1. ZodError → 400 avec fieldErrors
 * 2. Mongoose ValidationError → 400
 * 3. AppError → statusCode du message
 * 4. Sinon → 500, message générique en production
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

  console.error('Erreur non gérée :', err.message, err.stack);
  res.status(500).json({
    error: {
      message: env.NODE_ENV === 'production' ? 'Une erreur interne est survenue' : String(err),
    },
  });
};
