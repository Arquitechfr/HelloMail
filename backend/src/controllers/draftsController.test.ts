import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from '../test/setup.js';
import { authRoutes } from '../routes/authRoutes.js';
import { accountsRoutes } from '../routes/accountsRoutes.js';
import { draftsRoutes } from '../routes/draftsRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Mock des tests de connexion IMAP/SMTP.
vi.mock('../services/email/connectionTest.js', () => ({
  testImapConnection: vi.fn().mockResolvedValue(undefined),
  testSmtpConnection: vi.fn().mockResolvedValue(undefined),
}));

// Mock du service draft.
const { mockSaveDraft, mockDeleteDraft } = vi.hoisted(() => ({
  mockSaveDraft: vi.fn(),
  mockDeleteDraft: vi.fn(),
}));

vi.mock('../services/email/draftService.js', () => ({
  saveDraft: mockSaveDraft,
  deleteDraft: mockDeleteDraft,
}));

function createApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/accounts', accountsRoutes);
  app.use('/api/accounts', draftsRoutes);
  app.use(errorHandler);
  return app;
}

async function setupUserAndAccount(app: express.Express): Promise<{ token: string; accountId: string }> {
  await request(app).post('/api/auth/register').send({ email: 'draft@test.com', password: 'Password1' });
  const loginRes = await request(app).post('/api/auth/login').send({ email: 'draft@test.com', password: 'Password1' });
  const token = loginRes.body.accessToken;

  const createRes = await request(app)
    .post('/api/accounts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      emailAddress: 'imap@test.com',
      imap: { host: 'imap.test.com', port: 993, secure: true, username: 'user', password: 'pass' },
      smtp: { host: 'smtp.test.com', port: 465, secure: true },
    });

  return { token, accountId: createRes.body._id };
}

describe('Drafts routes (intégration)', () => {
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
    vi.clearAllMocks();
  });

  it('POST /:accountId/drafts → 201', async () => {
    const { token, accountId } = await setupUserAndAccount(app);

    mockSaveDraft.mockResolvedValueOnce({ ok: true, uid: 42 });

    const res = await request(app)
      .post(`/api/accounts/${accountId}/drafts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ to: ['bob@test.com'], subject: 'Test', text: 'Hello' });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.uid).toBe(42);
  });

  it('PATCH /:accountId/drafts/:uid → 200', async () => {
    const { token, accountId } = await setupUserAndAccount(app);

    mockSaveDraft.mockResolvedValueOnce({ ok: true, uid: 43 });

    const res = await request(app)
      .patch(`/api/accounts/${accountId}/drafts/100`)
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Updated', text: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.uid).toBe(43);
  });

  it('DELETE /:accountId/drafts/:uid → 204', async () => {
    const { token, accountId } = await setupUserAndAccount(app);

    mockDeleteDraft.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .delete(`/api/accounts/${accountId}/drafts/100`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
  });

  it('POST /:accountId/drafts sans auth → 401', async () => {
    const res = await request(app)
      .post('/api/accounts/507f1f77bcf86cd799439011/drafts')
      .send({ subject: 'Test', text: 'Hello' });

    expect(res.status).toBe(401);
  });

  it('POST /:accountId/drafts avec compte inexistant → 404', async () => {
    const { token } = await setupUserAndAccount(app);

    const res = await request(app)
      .post('/api/accounts/507f1f77bcf86cd799439099/drafts')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Test', text: 'Hello' });

    expect(res.status).toBe(404);
  });
});
