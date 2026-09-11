import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from '../test/setup.js';
import { authRoutes } from '../routes/authRoutes.js';
import { accountsRoutes } from '../routes/accountsRoutes.js';
import { messagesRoutes } from '../routes/messagesRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Mock des tests de connexion IMAP/SMTP
vi.mock('../services/email/connectionTest.js', () => ({
  testImapConnection: vi.fn().mockResolvedValue(undefined),
  testSmtpConnection: vi.fn().mockResolvedValue(undefined),
}));

const {
  mockExecuteUnsubscribe,
  mockBlockSender,
  mockImportEml,
} = vi.hoisted(() => ({
  mockExecuteUnsubscribe: vi.fn(),
  mockBlockSender: vi.fn(),
  mockImportEml: vi.fn(),
}));

vi.mock('../services/email/unsubscribeService.js', () => ({
  executeUnsubscribe: mockExecuteUnsubscribe,
}));

vi.mock('../services/email/blockSenderService.js', () => ({
  blockSender: mockBlockSender,
}));

vi.mock('../services/email/importEmailService.js', () => ({
  importEml: mockImportEml,
}));

function createApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/accounts/:accountId/messages/:folder/import', express.json({ limit: '30mb' }));
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/accounts', accountsRoutes);
  app.use('/api/accounts', messagesRoutes);
  app.use(errorHandler);
  return app;
}

async function setupUserAndAccount(app: express.Express): Promise<{ token: string; accountId: string }> {
  await request(app).post('/api/auth/register').send({ email: 'p16@test.com', password: 'Password1' });
  const loginRes = await request(app).post('/api/auth/login').send({ email: 'p16@test.com', password: 'Password1' });
  const token = loginRes.body.accessToken;

  const createRes = await request(app)
    .post('/api/accounts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      emailAddress: 'p16@test.com',
      imap: { host: 'imap.test.com', port: 993, secure: true, username: 'user', password: 'pass' },
      smtp: { host: 'smtp.test.com', port: 465, secure: true },
    });

  return { token, accountId: createRes.body._id };
}

describe('Phase 16 Endpoints (intégration)', () => {
  let app: express.Express;
  let token: string;
  let accountId: string;

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
    const creds = await setupUserAndAccount(app);
    token = creds.token;
    accountId = creds.accountId;
  });

  describe('POST /:accountId/messages/:folder/:uid/unsubscribe', () => {
    it('retourne 200 avec le résultat du désabonnement', async () => {
      mockExecuteUnsubscribe.mockResolvedValueOnce({
        success: true,
        action: 'one_click',
        details: 'Désabonnement en 1 clic effectué',
      });

      const res = await request(app)
        .post(`/api/accounts/${accountId}/messages/INBOX/42/unsubscribe`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.action).toBe('one_click');
      expect(mockExecuteUnsubscribe).toHaveBeenCalledWith(
        expect.anything(),
        'INBOX',
        42,
      );
    });

    it('retourne 401 sans authentification', async () => {
      const res = await request(app).post(`/api/accounts/${accountId}/messages/INBOX/42/unsubscribe`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /:accountId/messages/:folder/:uid/block-sender', () => {
    it('retourne 200 et bloque l expéditeur', async () => {
      mockBlockSender.mockResolvedValueOnce({
        blockedAddress: 'spammer@example.com',
        ruleCreated: true,
        movedToJunk: true,
      });

      const res = await request(app)
        .post(`/api/accounts/${accountId}/messages/INBOX/42/block-sender`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.blockedAddress).toBe('spammer@example.com');
      expect(res.body.ruleCreated).toBe(true);
      expect(res.body.movedToJunk).toBe(true);
      expect(mockBlockSender).toHaveBeenCalledWith(
        expect.anything(),
        'INBOX',
        42,
      );
    });

    it('retourne 401 sans authentification', async () => {
      const res = await request(app).post(`/api/accounts/${accountId}/messages/INBOX/42/block-sender`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /:accountId/messages/:folder/import', () => {
    it('retourne 200 lors de l import réussi d un email .eml', async () => {
      mockImportEml.mockResolvedValueOnce({
        uid: 999,
        messageId: '<imported-123@domain.com>',
      });

      const res = await request(app)
        .post(`/api/accounts/${accountId}/messages/INBOX/import`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          emlContent: Buffer.from('From: test@test.com\r\nSubject: Test\r\n\r\nBody').toString('base64'),
          isBase64: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.uid).toBe(999);
      expect(mockImportEml).toHaveBeenCalled();
    });

    it('retourne 400 si emlContent est absent', async () => {
      const res = await request(app)
        .post(`/api/accounts/${accountId}/messages/INBOX/import`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
