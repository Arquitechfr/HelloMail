import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from '../test/setup.js';
import tagsRoutes from '../routes/tagsRoutes.js';
import { authRoutes } from '../routes/authRoutes.js';
import { accountsRoutes } from '../routes/accountsRoutes.js';
import { messagesRoutes } from '../routes/messagesRoutes.js';
import { MessageModel } from '../models/Message.js';
import { errorHandler } from '../middleware/errorHandler.js';

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/accounts', accountsRoutes);
  app.use('/api/accounts', messagesRoutes);
  app.use('/api/tags', tagsRoutes);
  app.use(errorHandler);
  return app;
}

async function registerAndLogin(app: express.Express, email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Password1' });
  return res.body.accessToken;
}

async function createAccount(app: express.Express, token: string): Promise<string> {
  const res = await request(app)
    .post('/api/accounts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      emailAddress: 'tags@test.com',
      imap: { host: 'imap.test.com', port: 993, secure: true, username: 'user', password: 'pass' },
      smtp: { host: 'smtp.test.com', port: 465, secure: true },
    });
  return res.body._id;
}

describe('Tags routes (intégration)', () => {
  let app: express.Express;
  let token: string;

  beforeAll(async () => {
    await setupTestDb();
    app = createApp();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearDb();
    token = await registerAndLogin(app, 'taguser@test.com');
  });

  it('GET /api/tags sans auth → 401', async () => {
    const res = await request(app).get('/api/tags');
    expect(res.status).toBe(401);
  });

  it('GET /api/tags avec auth → 200 avec liste vide', async () => {
    const res = await request(app)
      .get('/api/tags')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('POST /api/tags crée un libellé → 201', async () => {
    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Urgent', color: '#ef4444' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Urgent');
    expect(res.body.data.color).toBe('#ef4444');
  });

  it('POST /api/tags refuse un doublon de nom → 409', async () => {
    await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Important' });

    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'important' });

    expect(res.status).toBe(409);
  });

  it('PATCH /api/tags/:id met à jour un libellé → 200', async () => {
    const createRes = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Clients' });

    const tagId = createRes.body.data._id;

    const updateRes = await request(app)
      .patch(`/api/tags/${tagId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Clients VIP', color: '#10b981' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe('Clients VIP');
    expect(updateRes.body.data.color).toBe('#10b981');
  });

  it('DELETE /api/tags/:id supprime un libellé → 200', async () => {
    const createRes = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'À jeter' });

    const tagId = createRes.body.data._id;

    const delRes = await request(app)
      .delete(`/api/tags/${tagId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(delRes.status).toBe(200);

    const listRes = await request(app)
      .get('/api/tags')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.body.data).toHaveLength(0);
  });

  it('PATCH /:accountId/messages/:folder/:uid/tags applique des tags à un message → 200', async () => {
    const accountId = await createAccount(app, token);

    await MessageModel.create({
      accountId,
      folder: 'INBOX',
      uid: 99,
      date: new Date(),
      flags: { seen: false, answered: false, flagged: false },
      size: 50,
      tags: [],
    });

    const res = await request(app)
      .patch(`/api/accounts/${accountId}/messages/INBOX/99/tags`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tags: ['Facture', '2026'] });

    expect(res.status).toBe(200);
    expect(res.body.data.tags).toEqual(['Facture', '2026']);
  });

  it('POST /api/tags/:accountId/batch applique des tags en masse → 200', async () => {
    const accountId = await createAccount(app, token);

    await MessageModel.create([
      { accountId, folder: 'INBOX', uid: 101, date: new Date(), flags: { seen: false, answered: false, flagged: false }, size: 50, tags: [] },
      { accountId, folder: 'INBOX', uid: 102, date: new Date(), flags: { seen: false, answered: false, flagged: false }, size: 50, tags: [] },
    ]);

    const res = await request(app)
      .post(`/api/tags/${accountId}/batch`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        folder: 'INBOX',
        uids: [101, 102],
        tags: ['Traitement-En-Cours'],
        mode: 'add',
      });

    expect(res.status).toBe(200);
    expect(res.body.modifiedCount).toBe(2);
  });
});
