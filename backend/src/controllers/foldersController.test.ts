import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from '../test/setup.js';
import { authRoutes } from '../routes/authRoutes.js';
import { accountsRoutes } from '../routes/accountsRoutes.js';
import { foldersRoutes } from '../routes/foldersRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Mock des tests de connexion IMAP/SMTP.
vi.mock('../services/email/connectionTest.js', () => ({
  testImapConnection: vi.fn().mockResolvedValue(undefined),
  testSmtpConnection: vi.fn().mockResolvedValue(undefined),
}));

// Mock du folderService.
const {
  mockListFolders,
  mockCreateFolder,
  mockRenameFolder,
  mockDeleteFolder,
  mockGetFolderStatus,
} = vi.hoisted(() => ({
  mockListFolders: vi.fn(),
  mockCreateFolder: vi.fn(),
  mockRenameFolder: vi.fn(),
  mockDeleteFolder: vi.fn(),
  mockGetFolderStatus: vi.fn(),
}));

vi.mock('../services/email/folderService.js', () => ({
  listFolders: mockListFolders,
  createFolder: mockCreateFolder,
  renameFolder: mockRenameFolder,
  deleteFolder: mockDeleteFolder,
  getFolderStatus: mockGetFolderStatus,
}));

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/accounts', accountsRoutes);
  app.use('/api/accounts', foldersRoutes);
  app.use(errorHandler);
  return app;
}

async function setupUserAndAccount(app: express.Express): Promise<{ token: string; accountId: string }> {
  await request(app).post('/api/auth/register').send({ email: 'folders@test.com', password: 'Password1' });
  const loginRes = await request(app).post('/api/auth/login').send({ email: 'folders@test.com', password: 'Password1' });
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

describe('Folders routes (intégration)', () => {
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

  it('GET /:accountId/folders → 200', async () => {
    const { token, accountId } = await setupUserAndAccount(app);

    mockListFolders.mockResolvedValueOnce([
      { path: 'INBOX', name: 'INBOX', delimiter: '/', specialUse: '\\Inbox', flags: [], status: { messages: 10, unseen: 2, uidNext: 50 } },
    ]);

    const res = await request(app)
      .get(`/api/accounts/${accountId}/folders`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].path).toBe('INBOX');
  });

  it('POST /:accountId/folders → 201', async () => {
    const { token, accountId } = await setupUserAndAccount(app);

    mockCreateFolder.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post(`/api/accounts/${accountId}/folders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ path: 'NewFolder' });

    expect(res.status).toBe(201);
    expect(res.body.path).toBe('NewFolder');
  });

  it('GET /:accountId/folders/:path/status → 200', async () => {
    const { token, accountId } = await setupUserAndAccount(app);

    mockGetFolderStatus.mockResolvedValueOnce({ messages: 42, unseen: 5, uidNext: 100 });

    const res = await request(app)
      .get(`/api/accounts/${accountId}/folders/INBOX/status`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.messages).toBe(42);
  });

  it('PATCH /:accountId/folders/:path → 200', async () => {
    const { token, accountId } = await setupUserAndAccount(app);

    mockRenameFolder.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .patch(`/api/accounts/${accountId}/folders/OldName`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newPath: 'NewName' });

    expect(res.status).toBe(200);
    expect(res.body.path).toBe('NewName');
  });

  it('DELETE /:accountId/folders/:path → 204', async () => {
    const { token, accountId } = await setupUserAndAccount(app);

    mockDeleteFolder.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .delete(`/api/accounts/${accountId}/folders/CustomFolder`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
  });

  it('DELETE /:accountId/folders/:path protégé → 403', async () => {
    const { token, accountId } = await setupUserAndAccount(app);

    const { AppError } = await import('../utils/AppError.js');
    mockDeleteFolder.mockRejectedValueOnce(
      AppError.forbidden('Le dossier système « INBOX » est protégé et ne peut pas être supprimé'),
    );

    const res = await request(app)
      .delete(`/api/accounts/${accountId}/folders/INBOX`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('protégé');
  });

  it('GET sans auth → 401', async () => {

    const res = await request(app).get('/api/accounts/507f1f77bcf86cd799439011/folders');

    expect(res.status).toBe(401);
  });
});
