import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from '../test/setup.js';
import { authRoutes } from '../routes/authRoutes.js';
import { accountsRoutes } from '../routes/accountsRoutes.js';
import { exportRoutes } from '../routes/exportRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Mocks des services
vi.mock('../services/email/connectionTest.js', () => ({
  testImapConnection: vi.fn().mockResolvedValue(undefined),
  testSmtpConnection: vi.fn().mockResolvedValue(undefined),
}));

const { mockStreamFolderMbox, mockStreamAccountZip, mockListFolders } = vi.hoisted(() => ({
  mockStreamFolderMbox: vi.fn(),
  mockStreamAccountZip: vi.fn(),
  mockListFolders: vi.fn(),
}));

vi.mock('../services/export/mboxExportService.js', () => ({
  streamFolderMbox: mockStreamFolderMbox,
  sanitizeFolderName: (folder: string) => folder.replace(/[\\/:*?"<>|]/g, '_') || 'Dossier',
}));

vi.mock('../services/export/zipExportService.js', () => ({
  streamAccountZip: mockStreamAccountZip,
}));

vi.mock('../services/email/folderService.js', () => ({
  listFolders: mockListFolders,
}));

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/accounts', accountsRoutes);
  app.use('/api/accounts', exportRoutes);
  app.use(errorHandler);
  return app;
}

async function setupUserAndAccount(app: express.Express): Promise<{ token: string; accountId: string }> {
  await request(app).post('/api/auth/register').send({ email: 'export@test.com', password: 'Password1' });
  const loginRes = await request(app).post('/api/auth/login').send({ email: 'export@test.com', password: 'Password1' });
  const token = loginRes.body.accessToken;

  const createRes = await request(app)
    .post('/api/accounts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      emailAddress: 'export-imap@test.com',
      imap: { host: 'imap.test.com', port: 993, secure: true, username: 'user', password: 'password' },
      smtp: { host: 'smtp.test.com', port: 465, secure: true },
    });

  return { token, accountId: createRes.body._id };
}

describe('Export Controller (Lot 29.3)', () => {
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
    const setup = await setupUserAndAccount(app);
    token = setup.token;
    accountId = setup.accountId;
  });

  describe('GET /api/accounts/:accountId/export/mbox', () => {
    it('retourne 401 si non authentifié', async () => {
      const res = await request(app).get(`/api/accounts/${accountId}/export/mbox?folder=INBOX`);
      expect(res.status).toBe(401);
    });

    it('retourne 400 si le paramètre folder est absent', async () => {
      const res = await request(app)
        .get(`/api/accounts/${accountId}/export/mbox`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('retourne 400 si le paramètre folder contient du path traversal', async () => {
      const res = await request(app)
        .get(`/api/accounts/${accountId}/export/mbox?folder=../etc/passwd`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('retourne 404 si le compte n existe pas', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .get(`/api/accounts/${fakeId}/export/mbox?folder=INBOX`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('stream le dossier au format MBOX avec les en-têtes HTTP corrects', async () => {
      mockStreamFolderMbox.mockImplementation(async (_acc, _folder, outStream) => {
        outStream.write('From test@test.com Sat Sep 12 12:00:00 2026\nSubject: Test\n\nBody\n\n');
        return { exportedCount: 1, folder: 'INBOX' };
      });

      const res = await request(app)
        .get(`/api/accounts/${accountId}/export/mbox?folder=INBOX`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/mbox');
      expect(res.headers['content-disposition']).toContain('attachment; filename="INBOX.mbox"');
      expect(mockStreamFolderMbox).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /api/accounts/:accountId/export/zip', () => {
    it('retourne 401 si non authentifié', async () => {
      const res = await request(app).get(`/api/accounts/${accountId}/export/zip`);
      expect(res.status).toBe(401);
    });

    it('retourne 200 et stream une archive ZIP pour les dossiers demandés', async () => {
      mockStreamAccountZip.mockImplementation(async (_acc, _folders, outStream) => {
        outStream.write(Buffer.from('PK\x03\x04')); // signature ZIP fictive
        outStream.end();
        return { totalFolders: 1, totalMessages: 10, exportedFolders: ['INBOX'] };
      });

      const res = await request(app)
        .get(`/api/accounts/${accountId}/export/zip?folders=INBOX`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/zip');
      expect(res.headers['content-disposition']).toContain('attachment; filename="mailora-');
      expect(res.headers['content-disposition']).toContain('.zip"');
      expect(mockStreamAccountZip).toHaveBeenCalledWith(
        expect.anything(),
        ['INBOX'],
        expect.anything(),
        expect.anything(),
      );
    });

    it('liste automatiquement les dossiers si aucun dossier spécifié', async () => {
      mockListFolders.mockResolvedValueOnce([{ path: 'INBOX' }, { path: 'Sent' }]);
      mockStreamAccountZip.mockImplementation(async (_acc, _folders, outStream) => {
        outStream.write(Buffer.from('PK\x03\x04'));
        outStream.end();
        return { totalFolders: 2, totalMessages: 25, exportedFolders: ['INBOX', 'Sent'] };
      });

      const res = await request(app)
        .get(`/api/accounts/${accountId}/export/zip`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(mockListFolders).toHaveBeenCalledTimes(1);
      expect(mockStreamAccountZip).toHaveBeenCalledWith(
        expect.anything(),
        ['INBOX', 'Sent'],
        expect.anything(),
        expect.anything(),
      );
    });
  });
});
