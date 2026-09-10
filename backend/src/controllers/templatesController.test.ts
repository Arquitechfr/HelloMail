import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from '../test/setup.js';
import templatesRoutes from '../routes/templatesRoutes.js';
import { authRoutes } from '../routes/authRoutes.js';
import { accountsRoutes } from '../routes/accountsRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { PRESET_TEMPLATES } from '../services/seed/presetData.js';

vi.mock('../services/email/connectionTest.js', () => ({
  testImapConnection: vi.fn().mockResolvedValue(undefined),
  testSmtpConnection: vi.fn().mockResolvedValue(undefined),
}));

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/accounts', accountsRoutes);
  app.use('/api/templates', templatesRoutes);
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
      emailAddress: 'templates@test.com',
      imap: { host: 'imap.test.com', port: 993, secure: true, username: 'user', password: 'pass' },
      smtp: { host: 'smtp.test.com', port: 465, secure: true },
    });
  return res.body.id || res.body._id;
}

describe('Templates routes (intégration)', () => {
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
    token = await registerAndLogin(app, 'tpluser@test.com');
  });

  it('GET /api/templates sans auth → 401', async () => {
    const res = await request(app).get('/api/templates');
    expect(res.status).toBe(401);
  });

  it('GET /api/templates avec auth → 200 avec les modèles prédéfinis semés au register', async () => {
    const res = await request(app)
      .get('/api/templates')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(PRESET_TEMPLATES.length);
    expect(res.body.data.every((t: { isPreset?: boolean }) => t.isPreset)).toBe(true);
  });

  it('POST /api/templates crée un modèle valide → 201', async () => {
    const res = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Remerciement',
        subject: 'Merci pour votre message',
        bodyHtml: '<p>Bonjour,<br>Merci beaucoup !</p>',
        shortcut: '!merci',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Remerciement');
    expect(res.body.data.subject).toBe('Merci pour votre message');
    expect(res.body.data.shortcut).toBe('!merci');
    expect(res.body.data.bodyText).toContain('Bonjour');
  });

  it('POST /api/templates valide les champs requis → 400', async () => {
    const res = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '',
      });

    expect(res.status).toBe(400);
  });

  it('POST /api/templates refuse un raccourci en doublon → 409', async () => {
    await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Modèle 1',
        bodyHtml: '<p>Test 1</p>',
        shortcut: '!duplicate',
      });

    const res = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Modèle 2',
        bodyHtml: '<p>Test 2</p>',
        shortcut: '!duplicate',
      });

    expect(res.status).toBe(409);
  });

  it('GET /api/templates/:id et PATCH /api/templates/:id → 200', async () => {
    const createRes = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'À modifier',
        bodyHtml: '<p>Avant</p>',
      });

    const templateId = createRes.body.data.id;

    const getRes = await request(app)
      .get(`/api/templates/${templateId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.title).toBe('À modifier');

    const patchRes = await request(app)
      .patch(`/api/templates/${templateId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Modifié',
        bodyHtml: '<p>Après</p>',
      });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.title).toBe('Modifié');
  });

  it('DELETE /api/templates/:id supprime le modèle → 200', async () => {
    const createRes = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'À supprimer',
        bodyHtml: '<p>Supprime moi</p>',
      });

    const templateId = createRes.body.data.id;

    const delRes = await request(app)
      .delete(`/api/templates/${templateId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/templates/${templateId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(404);
  });

  it('Isolation multi-utilisateurs et filtrage accountId', async () => {
    const tokenOther = await registerAndLogin(app, 'other@test.com');
    const accountId = await createAccount(app, token);

    // Modèle global de l'utilisateur principal
    await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Global User 1',
        bodyHtml: '<p>Global</p>',
      });

    // Modèle spécifique au compte de l'utilisateur principal
    await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Spécifique Compte User 1',
        bodyHtml: '<p>Compte</p>',
        accountId,
      });

    // L'autre utilisateur ne voit que ses modèles prédéfinis
    const otherRes = await request(app)
      .get('/api/templates')
      .set('Authorization', `Bearer ${tokenOther}`);
    expect(otherRes.body.data).toHaveLength(PRESET_TEMPLATES.length);
    expect(otherRes.body.data.every((t: { title: string }) => !t.title.includes('User 1'))).toBe(true);

    // L'utilisateur principal sans filtre voit les 2 + ses presets
    const allRes = await request(app)
      .get('/api/templates')
      .set('Authorization', `Bearer ${token}`);
    expect(allRes.body.data).toHaveLength(PRESET_TEMPLATES.length + 2);

    // L'utilisateur principal avec filtre voit les presets globaux, le global et le spécifique à ce compte
    const filterRes = await request(app)
      .get(`/api/templates?accountId=${accountId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(filterRes.body.data).toHaveLength(PRESET_TEMPLATES.length + 2);
  });
});
