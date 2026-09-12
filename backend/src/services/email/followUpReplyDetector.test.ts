import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from '../../test/setup.js';
import { MessageModel, type IMessageDocument } from '../../models/Message.js';
import { FollowUpReminderModel } from '../../models/FollowUpReminder.js';
import { createOrUpdateReminder } from './followUpReminderService.js';
import { checkAndResolveFollowUpReminder } from './followUpReplyDetector.js';

describe('followUpReplyDetector', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const accountId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearDb();
  });

  it('ignore les messages situés dans les dossiers envoyés ou brouillons', async () => {
    const dummySent = {
      folder: 'Sent',
      uid: 99,
      subject: 'Re: Test',
      from: { address: 'prospect@client.com' },
      to: [{ address: 'me@example.com' }],
    } as unknown as IMessageDocument;

    const resolved = await checkAndResolveFollowUpReminder(accountId, dummySent);
    expect(resolved).toBe(false);
  });

  it('résout automatiquement un rappel quand inReplyTo correspond exactement au messageId initial', async () => {
    // 1. Message envoyé avec rappel
    const originalMsg = await MessageModel.create({
      accountId,
      folder: 'Sent',
      uid: 100,
      messageId: '<orig-msg-100@domain.tld>',
      subject: 'Proposition d\'audit',
      from: { address: 'me@example.com' },
      to: [{ address: 'prospect@client.com' }],
      date: new Date('2026-03-01T10:00:00Z'),
      flags: { seen: true, answered: false, flagged: false },
    });

    const reminder = await createOrUpdateReminder(userId, accountId, 'Sent', 100, {
      remindAt: new Date(Date.now() + 86400000),
      note: 'Vérifier retour proposition',
    });
    expect(reminder.status).toBe('pending');

    // 2. Message réponse entrant dans INBOX
    const replyMsg = await MessageModel.create({
      accountId,
      folder: 'INBOX',
      uid: 200,
      messageId: '<reply-200@client.com>',
      inReplyTo: '<orig-msg-100@domain.tld>',
      subject: 'Re: Proposition d\'audit',
      from: { address: 'prospect@client.com' },
      to: [{ address: 'me@example.com' }],
      date: new Date('2026-03-02T10:00:00Z'),
      flags: { seen: false, answered: false, flagged: false },
    });

    const resolved = await checkAndResolveFollowUpReminder(accountId, replyMsg);
    expect(resolved).toBe(true);

    const updatedReminder = await FollowUpReminderModel.findById(reminder._id);
    expect(updatedReminder?.status).toBe('replied');
    expect(updatedReminder?.repliedAt).toBeDefined();

    const updatedOrigMsg = await MessageModel.findById(originalMsg._id);
    expect(updatedOrigMsg?.followUpStatus).toBe('replied');
  });

  it('résout le rappel par correspondance heuristique de sujet et d\'expéditeur', async () => {
    // 1. Message envoyé
    await MessageModel.create({
      accountId,
      folder: 'Sent',
      uid: 105,
      messageId: '<orig-105@domain.tld>',
      subject: 'Devis Refonte Mailora',
      from: { address: 'me@example.com' },
      to: [{ address: 'decisionnaire@bigcorp.fr' }],
      date: new Date('2026-03-01T10:00:00Z'),
      flags: { seen: true, answered: false, flagged: false },
    });

    const reminder = await createOrUpdateReminder(userId, accountId, 'Sent', 105, {
      remindAt: new Date(Date.now() + 86400000),
      note: 'Suivi devis',
    });

    // 2. Réponse entrante sans inReplyTo (ex: client web archaïque) mais avec Re: et même expéditeur
    const replyMsg = await MessageModel.create({
      accountId,
      folder: 'INBOX',
      uid: 205,
      messageId: '<reply-205@bigcorp.fr>',
      subject: 'Re: Devis Refonte Mailora',
      from: { address: 'decisionnaire@bigcorp.fr' },
      to: [{ address: 'me@example.com' }],
      date: new Date('2026-03-02T14:00:00Z'),
      flags: { seen: false, answered: false, flagged: false },
    });

    const resolved = await checkAndResolveFollowUpReminder(accountId, replyMsg);
    expect(resolved).toBe(true);

    const updatedReminder = await FollowUpReminderModel.findById(reminder._id);
    expect(updatedReminder?.status).toBe('replied');
  });

  it('ne résout pas le rappel si l\'expéditeur du mail avec même sujet n\'est pas le destinataire', async () => {
    await MessageModel.create({
      accountId,
      folder: 'Sent',
      uid: 110,
      messageId: '<orig-110@domain.tld>',
      subject: 'Facture #99',
      from: { address: 'me@example.com' },
      to: [{ address: 'destinataire@client.com' }],
      date: new Date(),
      flags: { seen: true, answered: false, flagged: false },
    });

    const reminder = await createOrUpdateReminder(userId, accountId, 'Sent', 110, {
      remindAt: new Date(Date.now() + 86400000),
    });

    // Email d'un tiers sans rapport
    const unrelatedMsg = await MessageModel.create({
      accountId,
      folder: 'INBOX',
      uid: 210,
      subject: 'Re: Facture #99',
      from: { address: 'autre@inconnu.com' },
      to: [{ address: 'me@example.com' }],
      date: new Date(),
      flags: { seen: false, answered: false, flagged: false },
    });

    const resolved = await checkAndResolveFollowUpReminder(accountId, unrelatedMsg);
    expect(resolved).toBe(false);

    const checkReminder = await FollowUpReminderModel.findById(reminder._id);
    expect(checkReminder?.status).toBe('pending');
  });
});
