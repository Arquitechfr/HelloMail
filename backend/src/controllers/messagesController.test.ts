import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Readable } from 'node:stream';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from '../test/setup.js';
import { authRoutes } from '../routes/authRoutes.js';
import { accountsRoutes } from '../routes/accountsRoutes.js';
import { messagesRoutes } from '../routes/messagesRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Mock des tests de connexion IMAP/SMTP.
vi.mock('../services/email/connectionTest.js', () => ({
  testImapConnection: vi.fn().mockResolvedValue(undefined),
  testSmtpConnection: vi.fn().mockResolvedValue(undefined),
}));

// Mock des services email (évite de se connecter à un vrai serveur IMAP/SMTP).
const {
  mockFetchMessageDetail,
  mockFetchAttachmentStream,
  mockFetchRawMessageStream,
  mockSendEmail,
  mockUpdateFlags,
  mockDeleteMessage,
  mockMoveMessage,
  mockMarkMessageAsJunk,
  mockBatchAction,
  mockGetConversationThread,
  mockSendReadReceipt,
} = vi.hoisted(() => ({
  mockFetchMessageDetail: vi.fn(),
  mockFetchAttachmentStream: vi.fn(),
  mockFetchRawMessageStream: vi.fn(),
  mockSendEmail: vi.fn(),
  mockUpdateFlags: vi.fn(),
  mockDeleteMessage: vi.fn(),
  mockMoveMessage: vi.fn(),
  mockMarkMessageAsJunk: vi.fn(),
  mockBatchAction: vi.fn(),
  mockGetConversationThread: vi.fn(),
  mockSendReadReceipt: vi.fn(),
}));

vi.mock('../services/email/receiptService.js', () => ({
  sendReadReceipt: mockSendReadReceipt,
}));

vi.mock('../services/email/messageFetchService.js', () => ({
  fetchMessageDetail: mockFetchMessageDetail,
}));
vi.mock('../services/email/attachmentService.js', () => ({
  fetchAttachmentStream: mockFetchAttachmentStream,
  fetchRawMessageStream: mockFetchRawMessageStream,
}));
vi.mock('../services/email/threadService.js', () => ({
  getConversationThread: mockGetConversationThread,
}));
vi.mock('../services/email/sendService.js', () => ({
  sendEmail: mockSendEmail,
}));
vi.mock('../services/email/messageActionService.js', () => ({
  updateFlags: mockUpdateFlags,
  deleteMessage: mockDeleteMessage,
  moveMessage: mockMoveMessage,
  markMessageAsJunk: mockMarkMessageAsJunk,
  batchAction: mockBatchAction,
}));

function createApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/accounts/:accountId/send', express.json({ limit: '30mb' }));
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/accounts', accountsRoutes);
  app.use('/api/accounts', messagesRoutes);
  app.use(errorHandler);
  return app;
}

async function setupUserAndAccount(app: express.Express): Promise<{ token: string; accountId: string }> {
  await request(app).post('/api/auth/register').send({ email: 'msg@test.com', password: 'Password1' });
  const loginRes = await request(app).post('/api/auth/login').send({ email: 'msg@test.com', password: 'Password1' });
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

describe('Messages routes (intégration)', () => {
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

  it('GET /:accountId/messages/:folder/:uid → 200 avec détail', async () => {
    const { token, accountId } = await setupUserAndAccount(app);

    mockFetchMessageDetail.mockResolvedValueOnce({
      subject: 'Test',
      from: { address: 'alice@test.com' },
      to: [{ address: 'bob@test.com' }],
      text: 'Hello',
      html: '<p>Hello</p>',
      flags: { seen: false, answered: false, flagged: false },
      attachments: [],
    });

    const res = await request(app)
      .get(`/api/accounts/${accountId}/messages/INBOX/100`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.subject).toBe('Test');
    expect(res.body.text).toBe('Hello');
  });

  it('POST /:accountId/send → 202', async () => {
    const { token, accountId } = await setupUserAndAccount(app);

    mockSendEmail.mockResolvedValueOnce({
      messageId: '<abc@test.com>',
      accepted: ['bob@test.com'],
      rejected: [],
    });

    const res = await request(app)
      .post(`/api/accounts/${accountId}/send`)
      .set('Authorization', `Bearer ${token}`)
      .send({ to: ['bob@test.com'], subject: 'Test', text: 'Hello' });

    expect(res.status).toBe(202);
    expect(res.body.messageId).toBe('<abc@test.com>');
  });

  it('POST /:accountId/send sans auth → 401', async () => {
    const res = await request(app)
      .post('/api/accounts/507f1f77bcf86cd799439011/send')
      .send({ to: ['bob@test.com'], subject: 'Test', text: 'Hello' });

    expect(res.status).toBe(401);
  });

  it('PATCH /:accountId/messages/:folder/:uid/flags → 200', async () => {
    const { token, accountId } = await setupUserAndAccount(app);

    mockUpdateFlags.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .patch(`/api/accounts/${accountId}/messages/INBOX/100/flags`)
      .set('Authorization', `Bearer ${token}`)
      .send({ seen: true });

    expect(res.status).toBe(200);
    expect(mockUpdateFlags).toHaveBeenCalledWith(expect.anything(), 'INBOX', 100, { seen: true });
  });

  it('DELETE /:accountId/messages/:folder/:uid → 204', async () => {
    const { token, accountId } = await setupUserAndAccount(app);

    mockDeleteMessage.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .delete(`/api/accounts/${accountId}/messages/INBOX/100`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
  });

  it('POST /:accountId/messages/:folder/:uid/move → 200', async () => {
    const { token, accountId } = await setupUserAndAccount(app);

    mockMoveMessage.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post(`/api/accounts/${accountId}/messages/INBOX/100/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ destination: 'Archive' });

    expect(res.status).toBe(200);
  });

  it('POST /:accountId/messages/:folder/:uid/junk → 200', async () => {
    const { token, accountId } = await setupUserAndAccount(app);

    mockMarkMessageAsJunk.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post(`/api/accounts/${accountId}/messages/INBOX/100/junk`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockMarkMessageAsJunk).toHaveBeenCalledWith(expect.anything(), 'INBOX', 100);
  });

  it('POST /:accountId/messages/batch markAsJunk → 200', async () => {
    const { token, accountId } = await setupUserAndAccount(app);

    mockBatchAction.mockResolvedValueOnce({ affected: 3 });

    const res = await request(app)
      .post(`/api/accounts/${accountId}/messages/batch`)
      .set('Authorization', `Bearer ${token}`)
      .send({ uids: [100, 101, 102], action: 'markAsJunk', folder: 'INBOX' });

    expect(res.status).toBe(200);
    expect(res.body.affected).toBe(3);
  });

  it('POST /:accountId/messages/batch → 200', async () => {
    const { token, accountId } = await setupUserAndAccount(app);

    mockBatchAction.mockResolvedValueOnce({ affected: 2 });

    const res = await request(app)
      .post(`/api/accounts/${accountId}/messages/batch`)
      .set('Authorization', `Bearer ${token}`)
      .send({ uids: [100, 101], action: 'markRead', folder: 'INBOX' });

    expect(res.status).toBe(200);
    expect(res.body.affected).toBe(2);
  });

  it('GET /:accountId/messages sans auth → 401', async () => {
    const res = await request(app).get('/api/accounts/507f1f77bcf86cd799439011/messages');

    expect(res.status).toBe(401);
  });

  it('GET avec un accountId inexistant → 404', async () => {
    const { token } = await setupUserAndAccount(app);

    const res = await request(app)
      .get('/api/accounts/507f1f77bcf86cd799439099/messages')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('GET /:accountId/messages/:folder/:uid/raw → 200 et télécharge le fichier .eml', async () => {
    const { token, accountId } = await setupUserAndAccount(app);

    const rawData = 'From: sender@test.com\r\nSubject: Test Raw\r\n\r\nHello';
    mockFetchRawMessageStream.mockResolvedValueOnce({
      stream: Readable.from([rawData]),
      contentType: 'message/rfc822',
      filename: 'Test Raw.eml',
      size: Buffer.byteLength(rawData),
    });

    const res = await request(app)
      .get(`/api/accounts/${accountId}/messages/INBOX/100/raw`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('message/rfc822');
    expect(res.headers['content-disposition']).toContain('filename="Test%20Raw.eml"');
    expect(res.text).toBe('From: sender@test.com\r\nSubject: Test Raw\r\n\r\nHello');
  });

  it('GET /:accountId/messages/:folder/:uid/thread → 200 avec liste du thread', async () => {
    const { token, accountId } = await setupUserAndAccount(app);

    mockGetConversationThread.mockResolvedValueOnce({
      conversationSubject: 'Test Thread',
      count: 2,
      messages: [{ uid: 100, subject: 'Test Thread' }, { uid: 101, subject: 'Re: Test Thread' }],
    });

    const res = await request(app)
      .get(`/api/accounts/${accountId}/messages/INBOX/100/thread`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.count).toBe(2);
    expect(res.body.conversationSubject).toBe('Test Thread');
  });

  it('POST /:accountId/messages/:folder/:uid/receipt → 200 envoie l\'accusé', async () => {
    const { token, accountId } = await setupUserAndAccount(app);
    mockSendReadReceipt.mockResolvedValueOnce({ ok: true, sentTo: 'sender@test.com' });

    const res = await request(app)
      .post(`/api/accounts/${accountId}/messages/INBOX/100/receipt`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.sentTo).toBe('sender@test.com');
  });
});
