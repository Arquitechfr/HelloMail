import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { compressionMiddleware, compressionFilter } from './compressionMiddleware.js';

function createTestApp(): express.Express {
  const app = express();
  app.use(compressionMiddleware);

  // Payload > 1 Ko
  app.get('/api/large', (_req, res) => {
    res.status(200).json({ data: 'a'.repeat(2048) });
  });

  // Payload < 1 Ko (environ 20 octets)
  app.get('/api/small', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  // Route SSE simulée
  app.get('/api/events', (_req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.write('data: hello\n\n');
    res.end();
  });

  return app;
}

describe('compressionMiddleware', () => {
  it('compresse avec gzip une réponse JSON supérieure à 1 Ko', async () => {
    const app = createTestApp();
    const res = await request(app)
      .get('/api/large')
      .set('Accept-Encoding', 'gzip');

    expect(res.status).toBe(200);
    expect(res.headers['content-encoding']).toBe('gzip');
  });

  it('ne compresse pas une réponse JSON inférieure à 1 Ko (seuil de 1024 octets)', async () => {
    const app = createTestApp();
    const res = await request(app)
      .get('/api/small')
      .set('Accept-Encoding', 'gzip');

    expect(res.status).toBe(200);
    expect(res.headers['content-encoding']).toBeUndefined();
  });

  it('ne compresse pas si le header x-no-compression est présent', async () => {
    const app = createTestApp();
    const res = await request(app)
      .get('/api/large')
      .set('Accept-Encoding', 'gzip')
      .set('x-no-compression', '1');

    expect(res.status).toBe(200);
    expect(res.headers['content-encoding']).toBeUndefined();
  });

  it('ne compresse pas les flux Server-Sent Events (/api/events)', async () => {
    const app = createTestApp();
    const res = await request(app)
      .get('/api/events')
      .set('Accept-Encoding', 'gzip');

    expect(res.status).toBe(200);
    expect(res.headers['content-encoding']).toBeUndefined();
  });
});

describe('compressionFilter', () => {
  it('retourne false quand accept text/event-stream est présent', () => {
    const fakeReq = {
      headers: { accept: 'text/event-stream' },
      path: '/api/some-stream',
    } as unknown as express.Request;
    const fakeRes = {
      getHeader: () => undefined,
    } as unknown as express.Response;

    expect(compressionFilter(fakeReq, fakeRes)).toBe(false);
  });

  it('retourne false quand Content-Type de la réponse est text/event-stream', () => {
    const fakeReq = {
      headers: {},
      path: '/api/some-route',
    } as unknown as express.Request;
    const fakeRes = {
      getHeader: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/event-stream; charset=utf-8' : undefined),
    } as unknown as express.Response;

    expect(compressionFilter(fakeReq, fakeRes)).toBe(false);
  });
});
