import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { mountBodyParsers } from './bodyParsers.js';
import { errorHandler } from './errorHandler.js';

/**
 * Régression : le parser global 100 Ko était monté avant le parser 30 Mo
 * de /send, ce qui rejetait tout envoi avec pièces jointes > ~100 Ko en 413.
 */
function createApp(): express.Express {
  const app = express();
  mountBodyParsers(app);

  app.post('/api/accounts/:accountId/send', (req, res) => {
    res.status(200).json({ received: JSON.stringify(req.body).length });
  });
  app.post('/api/other', (req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use(errorHandler);
  return app;
}

describe('mountBodyParsers', () => {
  it('accepte un body > 100 Ko sur /api/accounts/:id/send', async () => {
    const app = createApp();
    const bigBody = { text: 'x'.repeat(150 * 1024) };

    const res = await request(app)
      .post('/api/accounts/507f1f77bcf86cd799439011/send')
      .send(bigBody);

    expect(res.status).toBe(200);
  });

  it('rejette un body > 100 Ko sur les autres routes (413)', async () => {
    const app = createApp();
    const bigBody = { text: 'x'.repeat(150 * 1024) };

    const res = await request(app).post('/api/other').send(bigBody);

    expect(res.status).toBe(413);
  });

  it('accepte un body < 100 Ko sur les autres routes', async () => {
    const app = createApp();

    const res = await request(app).post('/api/other').send({ ok: true });

    expect(res.status).toBe(200);
  });
});
