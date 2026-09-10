import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from '../test/setup.js';
import { authRoutes } from '../routes/authRoutes.js';
import { accountsRoutes } from '../routes/accountsRoutes.js';
import { messagesRoutes } from '../routes/messagesRoutes.js';
import { MessageModel } from '../models/Message.js';
import { AccountModel } from '../models/Account.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { checkExpiredSnoozes } from '../services/email/snoozeService.js';

vi.mock('../services/email/connectionTest.js', () => ({
  testImapConnection: vi.fn().mockResolvedValue(undefined),
  testSmtpConnection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/realtime/eventPublisher.js', () => ({
  publishEvent: vi.fn().mockResolvedValue(undefined),
  EVENTS_CHANNEL: 'test:events',
}));

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/accounts', accountsRoutes);
  app.use('/api/accounts', messagesRoutes);
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
      emailAddress: 'snooze@test.com',
      imap: { host: 'imap.test.com', port: 993, secure: true, username: 'user', password: 'pass' },
      smtp: { host: 'smtp.test.com', port: 465, secure: true },
    });
  return res.body.id || res.body._id;
}

describe('Snooze routes & service (intégration)', () => {
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
    token = await registerAndLogin(app, 'snoozeuser@test.com');
    accountId = await createAccount(app, token);

    // Crée deux messages de test dans INBOX
    await MessageModel.create([
      {
        accountId,
        folder: 'INBOX',
        uid: 101,
        subject: 'Message Normal 1',
        from: { address: 'client1@example.com' },
        to: [{ address: 'snooze@test.com' }],
        date: new Date('2026-09-01T10:00:00Z'),
        flags: { seen: false, answered: false, flagged: false },
        hasAttachments: false,
        size: 1024,
      },
      {
        accountId,
        folder: 'INBOX',
        uid: 102,
        subject: 'Message Normal 2',
        from: { address: 'client2@example.com' },
        to: [{ address: 'snooze@test.com' }],
        date: new Date('2026-09-01T11:00:00Z'),
        flags: { seen: false, answered: false, flagged: false },
        hasAttachments: false,
        size: 2048,
      },
    ]);
  });

  it('PATCH /messages/:folder/:uid/snooze sans auth → 401', async () => {
    const res = await request(app)
      .patch(`/api/accounts/${accountId}/messages/INBOX/101/snooze`)
      .send({ snoozedUntil: new Date(Date.now() + 3600000).toISOString() });

    expect(res.status).toBe(401);
  });

  it('Met en sommeil un message et le masque de INBOX → 200', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();

    const snoozeRes = await request(app)
      .patch(`/api/accounts/${accountId}/messages/INBOX/101/snooze`)
      .set('Authorization', `Bearer ${token}`)
      .send({ snoozedUntil: futureDate });

    expect(snoozeRes.status).toBe(200);
    expect(snoozeRes.body.ok).toBe(true);

    // Liste normale INBOX : seul le message 102 doit apparaître
    const listRes = await request(app)
      .get(`/api/accounts/${accountId}/messages?folder=INBOX`)
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].uid).toBe(102);

    // Dossier virtuel 'Snoozed' : le message 101 doit y figurer
    const snoozedListRes = await request(app)
      .get(`/api/accounts/${accountId}/messages?folder=Snoozed`)
      .set('Authorization', `Bearer ${token}`);

    expect(snoozedListRes.status).toBe(200);
    expect(snoozedListRes.body.data).toHaveLength(1);
    expect(snoozedListRes.body.data[0].uid).toBe(101);
  });

  it('Annule la mise en sommeil ("unsnooze") avec snoozedUntil: null', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();

    // Snooze
    await request(app)
      .patch(`/api/accounts/${accountId}/messages/INBOX/101/snooze`)
      .set('Authorization', `Bearer ${token}`)
      .send({ snoozedUntil: futureDate });

    // Unsnooze
    const unsnoozeRes = await request(app)
      .patch(`/api/accounts/${accountId}/messages/INBOX/101/snooze`)
      .set('Authorization', `Bearer ${token}`)
      .send({ snoozedUntil: null });

    expect(unsnoozeRes.status).toBe(200);

    // Les 2 messages sont à nouveau visibles dans INBOX
    const listRes = await request(app)
      .get(`/api/accounts/${accountId}/messages?folder=INBOX`)
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.body.data).toHaveLength(2);
  });

  it('checkExpiredSnoozes réveille les messages dont la date est passée', async () => {
    // Met le message 101 en sommeil dans le passé (expiré)
    const pastDate = new Date(Date.now() - 60000);
    await MessageModel.updateOne({ accountId, uid: 101 }, { snoozedUntil: pastDate });

    // Exécute le réveil
    const wokenCount = await checkExpiredSnoozes();
    expect(wokenCount).toBe(1);

    // Le message doit avoir son snoozedUntil remis à null
    const msg = await MessageModel.findOne({ accountId, uid: 101 });
    expect(msg?.snoozedUntil).toBeNull();

    // Et être à nouveau visible dans INBOX
    const listRes = await request(app)
      .get(`/api/accounts/${accountId}/messages?folder=INBOX`)
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.body.data).toHaveLength(2);
  });
});
