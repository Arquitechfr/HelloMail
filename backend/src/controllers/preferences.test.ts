import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from '../test/setup.js';
import { authRoutes } from '../routes/authRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use(errorHandler);
  return app;
}

describe('User Preferences API (Lot 9.2)', () => {
  let app: express.Express;

  beforeAll(async () => {
    await setupTestDb();
    app = createApp();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearDb();
  });

  async function registerAndGetToken(email = 'user@example.com'): Promise<string> {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'Password1' });
    return res.body.accessToken;
  }

  it('PATCH /preferences sans authentification → 401', async () => {
    const res = await request(app)
      .patch('/api/auth/preferences')
      .send({ undoSendDelay: 10 });

    expect(res.status).toBe(401);
  });

  it('PATCH /preferences met à jour undoSendDelay à 10s → 200', async () => {
    const token = await registerAndGetToken();

    const res = await request(app)
      .patch('/api/auth/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ undoSendDelay: 10 });

    expect(res.status).toBe(200);
    expect(res.body.user.preferences).toBeDefined();
    expect(res.body.user.preferences.undoSendDelay).toBe(10);
  });

  it('PATCH /preferences accepte 0s (désactivé / immédiat) → 200', async () => {
    const token = await registerAndGetToken();

    const res = await request(app)
      .patch('/api/auth/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ undoSendDelay: 0 });

    expect(res.status).toBe(200);
    expect(res.body.user.preferences.undoSendDelay).toBe(0);
  });

  it('PATCH /preferences rejette un délai négatif → 400', async () => {
    const token = await registerAndGetToken();

    const res = await request(app)
      .patch('/api/auth/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ undoSendDelay: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('PATCH /preferences rejette un délai supérieur à 30s → 400', async () => {
    const token = await registerAndGetToken();

    const res = await request(app)
      .patch('/api/auth/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ undoSendDelay: 45 });

    expect(res.status).toBe(400);
  });

  it('PATCH /preferences rejette une valeur non numérique → 400', async () => {
    const token = await registerAndGetToken();

    const res = await request(app)
      .patch('/api/auth/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ undoSendDelay: 'dix' });

    expect(res.status).toBe(400);
  });

  it('GET /me retourne les préférences après modification → 200', async () => {
    const token = await registerAndGetToken();

    await request(app)
      .patch('/api/auth/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ undoSendDelay: 15 });

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.preferences?.undoSendDelay).toBe(15);
  });
});
