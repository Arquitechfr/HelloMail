import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from '../test/setup.js';
import { authRoutes } from '../routes/authRoutes.js';
import { accountsRoutes } from '../routes/accountsRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Mock des tests de connexion IMAP/SMTP (évite de se connecter à un vrai serveur).
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
  app.use(errorHandler);
  return app;
}

async function registerAndLogin(app: express.Express, email = 'accounts@test.com'): Promise<string> {
  await request(app).post('/api/auth/register').send({ email, password: 'Password1' });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password1' });
  return res.body.accessToken;
}

const validAccountBody = {
  emailAddress: 'imap@test.com',
  imap: { host: 'imap.test.com', port: 993, secure: true, username: 'user', password: 'pass' },
  smtp: { host: 'smtp.test.com', port: 465, secure: true },
};

describe('Accounts routes (intégration)', () => {
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

  it('create account → 201', async () => {
    const token = await registerAndLogin(app);

    const res = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send(validAccountBody);

    expect(res.status).toBe(201);
    expect(res.body.emailAddress).toBe('imap@test.com');
    expect(res.body.imapConfig.encryptedPassword).toBeUndefined();
  });

  it('create account sans auth → 401', async () => {
    const res = await request(app).post('/api/accounts').send(validAccountBody);

    expect(res.status).toBe(401);
  });

  it('create account avec un doublon → 409', async () => {
    const token = await registerAndLogin(app, 'dup@test.com');

    await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send(validAccountBody);

    const res = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send(validAccountBody);

    expect(res.status).toBe(409);
  });

  it('list accounts → 200', async () => {
    const token = await registerAndLogin(app, 'list@test.com');

    await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send(validAccountBody);

    const res = await request(app)
      .get('/api/accounts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].emailAddress).toBe('imap@test.com');
  });

  it('toggle account active → 200', async () => {
    const token = await registerAndLogin(app, 'toggle@test.com');

    const createRes = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send(validAccountBody);

    const accountId = createRes.body._id;

    const res = await request(app)
      .patch(`/api/accounts/${accountId}/active`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });

  it('delete account → 204', async () => {
    const token = await registerAndLogin(app, 'delete@test.com');

    const createRes = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send(validAccountBody);

    const accountId = createRes.body._id;

    const res = await request(app)
      .delete(`/api/accounts/${accountId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);

    // Vérifie que le compte n'existe plus.
    const listRes = await request(app)
      .get('/api/accounts')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.body).toHaveLength(0);
  });

  it('delete un compte inexistant → 404', async () => {
    const token = await registerAndLogin(app, 'notfound@test.com');

    const res = await request(app)
      .delete('/api/accounts/507f1f77bcf86cd799439099')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('GET /api/accounts/autoconfig → 200 avec configuration détectée ou fallback', async () => {
    const token = await registerAndLogin(app, 'autoconf@test.com');

    const res = await request(app)
      .get('/api/accounts/autoconfig?email=test@example.org')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('source');
    expect(res.body).toHaveProperty('imap');
    expect(res.body.imap.host).toContain('example.org');
  });

  it('PATCH /api/accounts/:id/signature → 200 avec signature mise à jour', async () => {
    const token = await registerAndLogin(app, 'signature-api@test.com');

    const createRes = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send(validAccountBody);

    const accountId = createRes.body._id;

    const res = await request(app)
      .patch(`/api/accounts/${accountId}/signature`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        enabled: true,
        text: 'Ma super signature Mailora',
      });

    expect(res.status).toBe(200);
    expect(res.body.signature.enabled).toBe(true);
    expect(res.body.signature.text).toBe('Ma super signature Mailora');
  });
});
