import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { errorHandler } from './errorHandler.js';
import { AppError } from '../utils/AppError.js';

function mockReqRes(): { req: Request; res: Response } {
  const req = {} as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return { req, res };
}

describe('errorHandler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('retourne 400 avec fieldErrors pour une ZodError', () => {
    const { req, res } = mockReqRes();
    // Construit une ZodError réelle via parse (format compatible Zod 4).
    const schema = z.object({ name: z.string().min(1, 'Nom requis') });
    let zodError: z.ZodError;
    try {
      schema.parse({ name: '' });
      throw new Error('Should have thrown');
    } catch (e) {
      zodError = e as z.ZodError;
    }

    errorHandler(zodError!, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        message: 'Erreur de validation des données',
        details: expect.any(Object),
      },
    });
  });

  it('retourne 400 pour une Mongoose ValidationError', () => {
    const { req, res } = mockReqRes();
    // Crée une ValidationError sans document réel (le constructor accepte un objet simple).
    const validationError = new mongoose.Error.ValidationError();
    validationError.errors = {
      email: new mongoose.Error.ValidatorError({ message: 'Email requis' }),
    };

    errorHandler(validationError, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        message: 'Erreur de validation des données',
        details: expect.any(Object),
      },
    });
  });

  it('retourne le statusCode d\'une AppError', () => {
    const { req, res } = mockReqRes();
    const error = AppError.notFound('Compte introuvable');

    errorHandler(error, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Compte introuvable' },
    });
  });

  it('retourne 401 pour AppError.unauthorized', () => {
    const { req, res } = mockReqRes();
    const error = AppError.unauthorized('Session expirée');

    errorHandler(error, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('retourne 409 pour AppError.conflict', () => {
    const { req, res } = mockReqRes();
    const error = AppError.conflict('Déjà existant');

    errorHandler(error, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('retourne 500 et le détail de l\'erreur en développement', () => {
    const { req, res } = mockReqRes();
    const error = new Error('Boom');

    // env.NODE_ENV vaut 'development' dans le .env de test.
    errorHandler(error, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    const json = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(json.error.message).toContain('Boom');
  });
});
