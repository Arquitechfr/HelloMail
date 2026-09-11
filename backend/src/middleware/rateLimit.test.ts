import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';
import { isGlobalExemptPath, createHandler } from './rateLimit.js';
import { errorHandler } from './errorHandler.js';

/**
 * Régression prod : le rate limit global (100 req/15 min) saturait l'API —
 * les sondes /health + /metrics, les reconnexions SSE /events et le polling
 * frontend consommaient le quota → 429 en cascade.
 */
describe('isGlobalExemptPath', () => {
  it.each(['/health', '/metrics', '/events'])('exempte %s', (path) => {
    expect(isGlobalExemptPath(path)).toBe(true);
  });

  it.each(['/accounts', '/contacts/search', '/auth/me'])('n\'exempte pas %s', (path) => {
    expect(isGlobalExemptPath(path)).toBe(false);
  });
});

describe('createHandler', () => {
  it('pose Retry-After basé sur la fenêtre du limiter et renvoie 429', async () => {
    const app = express();
    app.use(
      '/limited',
      rateLimit({
        windowMs: 60_000,
        limit: 1,
        standardHeaders: true,
        legacyHeaders: false,
        handler: createHandler(60_000) as never,
      }),
    );
    app.get('/limited', (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    await request(app).get('/limited').expect(200);
    const res = await request(app).get('/limited').expect(429);

    expect(res.headers['retry-after']).toBe('60');
    expect(res.body.error.message).toBeDefined();
  });

  it('utilise le message personnalisé quand fourni', async () => {
    const app = express();
    app.use(
      '/limited',
      rateLimit({
        windowMs: 5_000,
        limit: 1,
        handler: createHandler(5_000, 'Trop d\'envois') as never,
      }),
    );
    app.get('/limited', (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    await request(app).get('/limited').expect(200);
    const res = await request(app).get('/limited').expect(429);

    expect(res.headers['retry-after']).toBe('5');
    expect(res.body.error.message).toBe('Trop d\'envois');
  });
});
