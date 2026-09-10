import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from '../test/setup.js';
import rulesRoutes from '../routes/rulesRoutes.js';
import { authRoutes } from '../routes/authRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { PRESET_RULES } from '../services/seed/presetData.js';

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/rules', rulesRoutes);
  app.use(errorHandler);
  return app;
}

async function registerAndLogin(app: express.Express, email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Password1' });
  return res.body.accessToken;
}

describe('Rules routes (intégration)', () => {
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
    token = await registerAndLogin(app, 'rules@test.com');
  });

  it('GET /api/rules sans auth → 401', async () => {
    const res = await request(app).get('/api/rules');
    expect(res.status).toBe(401);
  });

  it('GET /api/rules avec auth → 200 avec les règles prédéfinies semées au register', async () => {
    const res = await request(app)
      .get('/api/rules')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(PRESET_RULES.length);
    expect(res.body.data.every((r: { isPreset?: boolean }) => r.isPreset)).toBe(true);
  });

  it('POST /api/rules crée une règle → 201', async () => {
    const res = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Trier devis',
        conditionMatch: 'all',
        conditions: [{ field: 'subject', operator: 'contains', value: 'devis' }],
        actions: [{ type: 'markAsFlagged' }],
        stopProcessing: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Trier devis');
    expect(res.body.data.order).toBe(PRESET_RULES.length);
  });

  it('POST /api/rules sans condition → 400', async () => {
    const res = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Invalide',
        conditions: [],
        actions: [{ type: 'markAsRead' }],
      });

    expect(res.status).toBe(400);
  });

  it('PATCH /api/rules/:id met à jour la règle → 200', async () => {
    const createRes = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Règle initiale',
        conditions: [{ field: 'subject', operator: 'contains', value: 'test' }],
        actions: [{ type: 'markAsRead' }],
      });

    const ruleId = createRes.body.data._id;

    const patchRes = await request(app)
      .patch(`/api/rules/${ruleId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Règle modifiée',
        isActive: false,
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.name).toBe('Règle modifiée');
    expect(patchRes.body.data.isActive).toBe(false);
  });

  it('DELETE /api/rules/:id supprime la règle → 200', async () => {
    const createRes = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'À supprimer',
        conditions: [{ field: 'from', operator: 'contains', value: 'spam' }],
        actions: [{ type: 'delete' }],
      });

    const ruleId = createRes.body.data._id;

    const deleteRes = await request(app)
      .delete(`/api/rules/${ruleId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);

    const getRes = await request(app)
      .get('/api/rules')
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.body.data.length).toBe(PRESET_RULES.length);
  });

  it('POST /api/rules/reorder réordonne les règles → 200', async () => {
    const r1 = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'R1',
        conditions: [{ field: 'subject', operator: 'contains', value: 'r1' }],
        actions: [{ type: 'markAsRead' }],
      });
    const r2 = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'R2',
        conditions: [{ field: 'subject', operator: 'contains', value: 'r2' }],
        actions: [{ type: 'markAsFlagged' }],
      });

    const reorderRes = await request(app)
      .post('/api/rules/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ruleIds: [r2.body.data._id, r1.body.data._id],
      });

    expect(reorderRes.status).toBe(200);

    const listRes = await request(app)
      .get('/api/rules')
      .set('Authorization', `Bearer ${token}`);
    const names = listRes.body.data.map((r: { name: string }) => r.name);
    expect(names.indexOf('R2')).toBeLessThan(names.indexOf('R1'));
  });
});
