import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from '../../test/setup.js';
import { MessageModel } from '../../models/Message.js';
import { FollowUpReminderModel } from '../../models/FollowUpReminder.js';
import { processDueFollowUpReminders, startFollowUpReminderRunner } from './followUpReminderRunner.js';

describe('followUpReminderRunner', () => {
  const userId = new mongoose.Types.ObjectId();
  const accountId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearDb();
  });

  it('ne déclenche aucun rappel si aucun n\'est arrivé à échéance', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    await FollowUpReminderModel.create({
      userId,
      accountId,
      folder: 'Sent',
      uid: 50,
      threadSubject: 'Mail futur',
      targetRecipient: 'test@client.com',
      remindAt: futureDate,
      status: 'pending',
    });

    const processed = await processDueFollowUpReminders();
    expect(processed).toBe(0);

    const check = await FollowUpReminderModel.findOne({ uid: 50 });
    expect(check?.status).toBe('pending');
  });

  it('déclenche les rappels arrivés à échéance et met à jour MessageModel', async () => {
    await MessageModel.create({
      accountId,
      folder: 'Sent',
      uid: 55,
      subject: 'Devis échu',
      from: { address: 'me@example.com' },
      to: [{ address: 'prospect@client.com' }],
      date: new Date(),
      flags: { seen: true, answered: false, flagged: false },
      followUpStatus: 'pending',
    });

    const pastDate = new Date(Date.now() - 5000);
    const reminder = await FollowUpReminderModel.create({
      userId,
      accountId,
      folder: 'Sent',
      uid: 55,
      threadSubject: 'Devis échu',
      targetRecipient: 'prospect@client.com',
      remindAt: pastDate,
      status: 'pending',
    });

    const processed = await processDueFollowUpReminders();
    expect(processed).toBe(1);

    const checkReminder = await FollowUpReminderModel.findById(reminder._id);
    expect(checkReminder?.status).toBe('triggered');
    expect(checkReminder?.triggeredAt).toBeDefined();

    const checkMessage = await MessageModel.findOne({ accountId, folder: 'Sent', uid: 55 });
    expect(checkMessage?.followUpStatus).toBe('triggered');
  });

  it('startFollowUpReminderRunner s\'initialise et s\'arrête proprement', () => {
    const runner = startFollowUpReminderRunner(100000);
    expect(runner).toBeDefined();
    expect(typeof runner.stop).toBe('function');
    runner.stop();
  });
});
