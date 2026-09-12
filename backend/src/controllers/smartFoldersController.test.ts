import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from '../test/setup.js';
import smartFoldersRoutes from '../routes/smartFoldersRoutes.js';
import { authRoutes } from '../routes/authRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/smart-folders', smartFoldersRoutes);
  app.use(errorHandler);
  return app;
}

async function registerAndLogin(app: express.Express, email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Password1' });
  return res.body.accessToken;
}

describe('SmartFolders routes (intégration)', () => {
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
    token = await registerAndLogin(app, 'smartfolders@test.com');
  });

  it('GET /api/smart-folders sans auth → 401', async () => {
    const res = await request(app).get('/api/smart-folders');
    expect(res.status).toBe(401);
  });

  it('GET /api/smart-folders avec auth → 200 vide au départ', async () => {
    const res = await request(app)
      .get('/api/smart-folders')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('POST /api/smart-folders avec body invalide → 400', async () => {
    const res = await request(app)
      .post('/api/smart-folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '' });

    expect(res.status).toBe(400);
  });

  it('CRUD complet d\'un dossier intelligent', async () => {
    // 1. Création
    const createRes = await request(app)
      .post('/api/smart-folders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Messages non lus',
        query: 'is:unread',
        icon: 'Inbox',
        color: '#3b82f6',
      });

    expect(createRes.status).toBe(201);
    const createdId = createRes.body.data._id;
    expect(createRes.body.data.name).toBe('Messages non lus');
    expect(createRes.body.data.query).toBe('is:unread');

    // 2. Compteurs
    const countsRes = await request(app)
      .get('/api/smart-folders/counts')
      .set('Authorization', `Bearer ${token}`);

    expect(countsRes.status).toBe(200);
    expect(countsRes.body.data[createdId]).toBeDefined();
    expect(countsRes.body.data[createdId].total).toBe(0);

    // 3. Messages
    const messagesRes = await request(app)
      .get(`/api/smart-folders/${createdId}/messages`)
      .set('Authorization', `Bearer ${token}`);

    expect(messagesRes.status).toBe(200);
    expect(messagesRes.body.total).toBe(0);
    expect(messagesRes.body.data).toEqual([]);
    expect(messagesRes.body.smartFolder.name).toBe('Messages non lus');

    // 4. Mise à jour
    const updateRes = await request(app)
      .patch(`/api/smart-folders/${createdId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Non lus modifiés',
        color: '#10b981',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe('Non lus modifiés');
    expect(updateRes.body.data.color).toBe('#10b981');

    // 5. Suppression
    const deleteRes = await request(app)
      .delete(`/api/smart-folders/${createdId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);

    // 6. Vérification liste vide
    const listRes = await request(app)
      .get('/api/smart-folders')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(0);
  });

  it('POST /api/smart-folders/reorder met à jour l\'ordre', async () => {
    const res1 = await request(app)
      .post('/api/smart-folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'F1', query: 'f1' });
    const res2 = await request(app)
      .post('/api/smart-folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'F2', query: 'f2' });

    const id1 = res1.body.data._id;
    const id2 = res2.body.data._id;

    const reorderRes = await request(app)
      .post('/api/smart-folders/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [id2, id1] });

    expect(reorderRes.status).toBe(200);

    const listRes = await request(app)
      .get('/api/smart-folders')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.body.data[0]._id).toBe(id2);
    expect(listRes.body.data[1]._id).toBe(id1);
  });
});
