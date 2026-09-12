import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from '../test/setup.js';
import { authRoutes } from '../routes/authRoutes.js';
import { accountsRoutes } from '../routes/accountsRoutes.js';
import { reminderRoutes } from '../routes/reminderRoutes.js';
import { messagesRoutes } from '../routes/messagesRoutes.js';
import { MessageModel } from '../models/Message.js';
import { errorHandler } from '../middleware/errorHandler.js';

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
  app.use('/api/accounts', reminderRoutes);
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
      emailAddress: 'reminders@test.com',
      imap: { host: 'imap.test.com', port: 993, secure: true, username: 'user', password: 'pass' },
      smtp: { host: 'smtp.test.com', port: 465, secure: true },
    });
  return res.body.id || res.body._id;
}

describe('Reminder routes & controller', () => {
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
    token = await registerAndLogin(app, 'user.reminders@test.com');
    accountId = await createAccount(app, token);
  });

  it('crée un rappel sur un message existant', async () => {
    await MessageModel.create({
      accountId,
      folder: 'Sent',
      uid: 10,
      subject: 'Proposition client',
      from: { address: 'me@example.com' },
      to: [{ address: 'prospect@corp.com' }],
      date: new Date(),
      flags: { seen: true, answered: false, flagged: false },
    });

    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const res = await request(app)
      .post(`/api/accounts/${accountId}/messages/Sent/10/reminder`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        remindAt: futureDate,
        note: 'Relancer le prospect',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.note).toBe('Relancer le prospect');
    expect(res.body.targetRecipient).toBe('prospect@corp.com');
  });

  it('récupère le rappel associé à un message', async () => {
    await MessageModel.create({
      accountId,
      folder: 'Sent',
      uid: 20,
      subject: 'Facture #500',
      from: { address: 'me@example.com' },
      to: [{ address: 'client@corp.com' }],
      date: new Date(),
      flags: { seen: true, answered: false, flagged: false },
    });

    const futureDate = new Date(Date.now() + 86400000).toISOString();
    await request(app)
      .post(`/api/accounts/${accountId}/messages/Sent/20/reminder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ remindAt: futureDate });

    const res = await request(app)
      .get(`/api/accounts/${accountId}/messages/Sent/20/reminder`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.reminder).toBeDefined();
    expect(res.body.reminder.uid).toBe(20);
  });

  it('snooze, dismiss et cancel un rappel', async () => {
    await MessageModel.create({
      accountId,
      folder: 'Sent',
      uid: 30,
      subject: 'Devis #700',
      from: { address: 'me@example.com' },
      to: [{ address: 'client@corp.com' }],
      date: new Date(),
      flags: { seen: true, answered: false, flagged: false },
    });

    const createRes = await request(app)
      .post(`/api/accounts/${accountId}/messages/Sent/30/reminder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ remindAt: new Date(Date.now() + 86400000).toISOString() });

    const reminderId = createRes.body.id || createRes.body._id;

    // 1. Snooze
    const snoozeDate = new Date(Date.now() + 172800000).toISOString();
    const snoozeRes = await request(app)
      .post(`/api/accounts/${accountId}/reminders/${reminderId}/snooze`)
      .set('Authorization', `Bearer ${token}`)
      .send({ remindAt: snoozeDate });
    expect(snoozeRes.status).toBe(200);
    expect(snoozeRes.body.status).toBe('pending');

    // 2. Dismiss
    const dismissRes = await request(app)
      .post(`/api/accounts/${accountId}/reminders/${reminderId}/dismiss`)
      .set('Authorization', `Bearer ${token}`);
    expect(dismissRes.status).toBe(200);
    expect(dismissRes.body.ok).toBe(true);

    // 3. Cancel
    const cancelRes = await request(app)
      .delete(`/api/accounts/${accountId}/reminders/${reminderId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.ok).toBe(true);
  });

  it('liste les rappels paginés pour un compte', async () => {
    const res = await request(app)
      .get(`/api/accounts/${accountId}/reminders`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toBeInstanceOf(Array);
    expect(res.body.total).toBe(0);
  });

  it('GET /:accountId/messages?folder=__reminders__ filtre les messages à relancer', async () => {
    await MessageModel.create({
      accountId,
      folder: 'Sent',
      uid: 99,
      subject: 'Message à relancer',
      from: { address: 'me@example.com' },
      to: [{ address: 'relance@test.com' }],
      date: new Date(),
      flags: { seen: true, answered: false, flagged: false },
      followUpStatus: 'triggered',
      followUpRemindAt: new Date(Date.now() - 10000),
    });

    const res = await request(app)
      .get(`/api/accounts/${accountId}/messages?folder=__reminders__`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].uid).toBe(99);
  });
});
