import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { validate } from './validate.js';
import { AppError } from '../utils/AppError.js';

function mockReqRes(overrides: Partial<Request> = {}): {
  req: Request;
  res: Response;
  next: NextFunction & ReturnType<typeof vi.fn>;
} {
  const req = { body: {}, params: {}, query: {}, ...overrides } as Request;
  const res = {} as Response;
  const next = vi.fn() as NextFunction & ReturnType<typeof vi.fn>;
  return { req, res, next };
}

describe('validate middleware', () => {
  it('valide un body valide et appelle next sans erreur', async () => {
    const schema = z.object({ name: z.string().min(1) });
    const { req, res, next } = mockReqRes({ body: { name: 'Alice' } });

    await validate({ body: schema })(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toHaveLength(0);
    expect(req.body).toEqual({ name: 'Alice' });
  });

  it('rejette un body invalide avec ZodError (passée au errorHandler)', async () => {
    const schema = z.object({ name: z.string().min(1, 'Nom requis') });
    const { req, res, next } = mockReqRes({ body: { name: '' } });

    await validate({ body: schema })(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(ZodError);
    expect(error.issues[0].message).toBe('Nom requis');
  });

  it('valide les params', async () => {
    const schema = z.object({ id: z.string().regex(/^[0-9a-f]{24}$/) });
    const { req, res, next } = mockReqRes({ params: { id: 'a'.repeat(24) } });

    await validate({ params: schema })(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toHaveLength(0);
  });

  it('valide les query', async () => {
    const schema = z.object({ page: z.coerce.number().default(1) });
    const { req, res, next } = mockReqRes({ query: { page: '5' } });

    await validate({ query: schema })(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.query).toEqual({ page: 5 });
  });

  it('applique les valeurs par défaut de Zod', async () => {
    const schema = z.object({ folder: z.string().default('INBOX') });
    const { req, res, next } = mockReqRes({ query: {} });

    await validate({ query: schema })(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toHaveLength(0);
    expect(req.query).toEqual({ folder: 'INBOX' });
  });

  it('passe les erreurs non-Zod au next sans wrapping', async () => {
    // Une erreur lancée dans refine n'est pas encapsulée par Zod 4 en ZodError :
    // elle remonte directement → validate la passe au next telle quelle.
    const schema = z.object({
      crash: z.string().refine(() => {
        throw new Error('Erreur interne');
      }),
    });
    const { req, res, next } = mockReqRes({ body: { crash: 'test' } });

    await validate({ body: schema })(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Erreur interne');
    expect(error).not.toBeInstanceOf(AppError);
  });
});
